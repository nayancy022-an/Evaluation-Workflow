const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const http = require("node:http");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const { URL } = require("node:url");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const { connectDb } = require("./db");
const Evaluation = require("./models/Evaluation");
const User = require("./models/User");
const { issueCookie, clearCookie, getUser, publicUser } = require("./auth");

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, "..");
const STATIC_ROOT = fsSync.existsSync(path.join(ROOT, "dist")) ? path.join(ROOT, "dist") : ROOT;

const ROLE_KEYWORDS = {
  "Frontend Engineer": ["react", "typescript", "javascript", "accessibility", "performance", "css", "ui", "testing"],
  "Full Stack Engineer": ["react", "typescript", "node", "api", "postgresql", "cloud", "testing", "ci/cd"],
  "Backend Engineer": ["node", "api", "database", "postgresql", "distributed", "cloud", "testing", "security"],
  "Data Engineer": ["python", "sql", "pipeline", "spark", "warehouse", "etl", "airflow", "cloud"],
  "ML Engineer": ["python", "model", "ml", "pytorch", "tensorflow", "data", "deployment", "evaluation"]
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function clamp(value, min = 0, max = 100) {
  return Math.min(Math.max(Math.round(value), min), max);
}

function jsonResponse(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function textResponse(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

async function readRequestBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) {
      throw new Error("Request body is too large.");
    }
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function validateCandidate(input = {}) {
  const name = String(input.name || "").trim();
  if (!name) throw new HttpError(400, "Candidate name is required.");
  if (!String(input.resumeText || "").trim()) throw new HttpError(400, "Resume text is required to score a candidate.");
  const solved = Number(input.leetcodeSolved || 0);
  const acceptance = Number(input.leetcodeAcceptance || 0);
  if (!Number.isFinite(solved) || solved < 0) throw new HttpError(400, "LeetCode solved must be a positive number.");
  if (!Number.isFinite(acceptance) || acceptance < 0 || acceptance > 100) {
    throw new HttpError(400, "Acceptance rate must be between 0 and 100.");
  }
}

function normalizeCandidate(input = {}) {
  return {
    name: String(input.name || "Unnamed Candidate").trim() || "Unnamed Candidate",
    role: ROLE_KEYWORDS[input.role] ? input.role : "Full Stack Engineer",
    githubUser: String(input.githubUser || "").trim(),
    leetcodeUser: String(input.leetcodeUser || "").trim(),
    leetcodeSolved: Number(input.leetcodeSolved || 0),
    leetcodeAcceptance: Number(input.leetcodeAcceptance || 0),
    resumeText: String(input.resumeText || "").trim()
  };
}

async function fetchGithubProfile(username) {
  if (!username) {
    return {
      repos: 0,
      stars: 0,
      followers: 0,
      publicProfile: false,
      languages: [],
      source: "empty"
    };
  }

  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "EvalFlow-Developer-Evaluation"
  };

  const userResponse = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, { headers });
  if (!userResponse.ok) {
    throw new Error(`GitHub profile "${username}" was not found.`);
  }

  const user = await userResponse.json();
  const repoResponse = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=30`,
    { headers }
  );
  const repos = repoResponse.ok ? await repoResponse.json() : [];
  const stars = repos.reduce((total, repo) => total + (repo.stargazers_count || 0), 0);
  const languages = [...new Set(repos.map((repo) => repo.language).filter(Boolean))].slice(0, 6);

  return {
    repos: user.public_repos || repos.length || 0,
    stars,
    followers: user.followers || 0,
    publicProfile: true,
    languages,
    source: "github"
  };
}

function fallbackGithubProfile() {
  return {
    repos: 8,
    stars: 18,
    followers: 12,
    publicProfile: false,
    languages: ["JavaScript", "TypeScript"],
    source: "fallback"
  };
}

function scoreGithub(profile) {
  const repoScore = Math.min(profile.repos, 60) * 0.75;
  const starScore = Math.log10(profile.stars + 1) * 16;
  const followerScore = Math.log10(profile.followers + 1) * 10;
  const languageScore = Math.min(profile.languages.length * 5, 20);
  const sourceBoost = profile.publicProfile ? 8 : 0;
  return clamp(repoScore + starScore + followerScore + languageScore + sourceBoost, 20, 98);
}

function scoreLeetcode(solved, acceptance) {
  const solvedScore = Math.min(solved, 700) / 700 * 76;
  const acceptanceScore = Math.min(acceptance, 95) / 95 * 24;
  return clamp(solvedScore + acceptanceScore, 10, 99);
}

function scoreResume(text, role) {
  const normalized = text.toLowerCase();
  const keywords = ROLE_KEYWORDS[role] || [];
  const keywordHits = keywords.filter((keyword) => normalized.includes(keyword.toLowerCase())).length;
  const keywordScore = keywords.length ? (keywordHits / keywords.length) * 56 : 30;
  const leadershipScore = /(led|owned|designed|architected|mentored|collaborated|launched|improved)/i.test(text) ? 14 : 4;
  const testingScore = /(test|quality|ci\/cd|pipeline|monitoring|accessibility|security)/i.test(text) ? 12 : 3;
  const experienceScore = /(\d+)\+?\s*(years|yrs)/i.test(text) ? 12 : Math.min(text.length / 80, 10);
  const clarityScore = text.length > 120 ? 6 : 2;
  return clamp(keywordScore + leadershipScore + testingScore + experienceScore + clarityScore, 12, 98);
}

function matchedKeywords(candidate) {
  const normalized = candidate.resumeText.toLowerCase();
  return (ROLE_KEYWORDS[candidate.role] || []).filter((keyword) => normalized.includes(keyword.toLowerCase()));
}

function buildCompetencies(scores, candidate, github) {
  const resume = candidate.resumeText.toLowerCase();
  const languageFit = github.languages.some((language) => resume.includes(language.toLowerCase())) ? 5 : 0;
  return {
    "Code Craft": clamp(scores.github * 0.55 + scores.resume * 0.35 + languageFit),
    Systems: clamp(scores.resume * 0.58 + scores.github * 0.32),
    "Problem Solving": clamp(scores.leetcode * 0.8 + scores.resume * 0.12),
    "Product Sense": clamp(scores.resume * 0.62 + scores.github * 0.2 + 10),
    Communication: clamp(scores.resume * 0.72 + 18),
    Reliability: clamp(scores.github * 0.45 + scores.resume * 0.35 + scores.leetcode * 0.12)
  };
}

const POTENTIAL_COLUMNS = ["Resume fit", "GitHub", "LeetCode", "Hire potential"];

// Heatmap data: how likely this candidate is to be recruited for each role.
function buildPotential(candidate, github, scores) {
  const rows = Object.keys(ROLE_KEYWORDS).map((role) => {
    const resume = scoreResume(candidate.resumeText, role);
    const overall = clamp(scores.github * 0.34 + scores.leetcode * 0.28 + resume * 0.38);
    return { role, values: [resume, scores.github, scores.leetcode, overall] };
  });
  const best = rows.reduce((top, row) => (row.values[3] > top.values[3] ? row : top), rows[0]);
  const target = rows.find((row) => row.role === candidate.role) || best;
  const score = target.values[3];
  // Logistic curve: ~50% chance at a score of 60, saturating towards 0 / 100.
  const probability = clamp(100 / (1 + Math.exp(-(score - 60) / 10)), 1, 99);
  const tier = score >= 75 ? "High" : score >= 55 ? "Moderate" : "Low";
  return {
    score,
    probability,
    tier,
    targetRole: target.role,
    bestRole: best.role,
    columns: POTENTIAL_COLUMNS,
    rows
  };
}

function recommendation(score) {
  if (score >= 84) return "Advance to technical screen";
  if (score >= 72) return "Review with hiring manager";
  if (score >= 60) return "Hold for matching role";
  return "Do not advance";
}

function buildAiSummary(candidate, scores, github, keywords) {
  const strongest =
    Object.entries(scores.competencies).sort((first, second) => second[1] - first[1])[0]?.[0] || "Technical Fit";
  const evidence =
    github.source === "github"
      ? `${github.repos} public repos and ${github.followers} followers`
      : "limited verifiable GitHub evidence";

  return {
    model: "transparent-rubric-v1",
    summary: `${candidate.name} is a ${recommendation(scores.overall).toLowerCase()} candidate for ${candidate.role}. Strongest signal: ${strongest}.`,
    strengths: [
      `${scores.resume}/100 resume match with ${keywords.length} role keywords detected`,
      `${scores.leetcode}/100 problem-solving score from ${candidate.leetcodeSolved} solved problems`,
      `${scores.github}/100 GitHub score from ${evidence}`
    ],
    risks:
      scores.overall >= 80
        ? ["Validate depth during the technical screen."]
        : ["Review project quality and role fit before advancing."]
  };
}

async function evaluateCandidate(input) {
  validateCandidate(input);
  const candidate = normalizeCandidate(input);
  let github;
  let githubWarning = null;

  try {
    github = await fetchGithubProfile(candidate.githubUser);
  } catch (error) {
    github = fallbackGithubProfile();
    githubWarning = error.message;
  }

  const githubScore = scoreGithub(github);
  const leetcodeScore = scoreLeetcode(candidate.leetcodeSolved, candidate.leetcodeAcceptance);
  const resumeScore = scoreResume(candidate.resumeText, candidate.role);
  const overallScore = clamp(githubScore * 0.34 + leetcodeScore * 0.28 + resumeScore * 0.38);
  const baseScores = {
    overall: overallScore,
    github: githubScore,
    leetcode: leetcodeScore,
    resume: resumeScore
  };
  const scores = {
    ...baseScores,
    competencies: buildCompetencies(baseScores, candidate, github)
  };
  const keywords = matchedKeywords(candidate);

  return {
    candidate,
    github,
    scores,
    recommendation: recommendation(scores.overall),
    matchedKeywords: keywords,
    potential: buildPotential(candidate, github, scores),
    ai: buildAiSummary(candidate, scores, github, keywords),
    warnings: githubWarning ? [githubWarning] : [],
    evaluatedAt: new Date().toISOString()
  };
}

async function listEvaluations(owner) {
  const rows = await Evaluation.find({ owner }).sort({ evaluatedAt: -1 }).limit(50);
  return rows.map((row) => {
    const json = row.toJSON();
    return { ...json, potential: json.potential || buildPotential(json.candidate, json.github, json.scores) };
  });
}

// One saved evaluation per candidate name per recruiter; re-submitting updates it.
async function upsertEvaluation(evaluation, owner) {
  const existing = await Evaluation.findOne({ owner, "candidate.name": evaluation.candidate.name });
  if (existing) {
    existing.set(evaluation);
    await existing.save();
    return existing.toJSON();
  }
  const created = await Evaluation.create({ ...evaluation, owner });
  return created.toJSON();
}

// Simple in-memory limiter for login attempts: 10 tries per 15 minutes per IP + email.
const loginAttempts = new Map();
function checkLoginRate(key) {
  const now = Date.now();
  const recent = (loginAttempts.get(key) || []).filter((time) => now - time < 15 * 60 * 1000);
  if (recent.length >= 10) throw new HttpError(429, "Too many login attempts. Try again in 15 minutes.");
  recent.push(now);
  loginAttempts.set(key, recent);
}

async function handleApi(req, res, pathname) {
  // ---------- Public routes ----------
  if (req.method === "GET" && pathname === "/api/health") {
    return jsonResponse(res, 200, {
      ok: true,
      service: "EvalFlow API",
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === "GET" && pathname === "/api/roles") {
    return jsonResponse(res, 200, { roles: Object.keys(ROLE_KEYWORDS), roleKeywords: ROLE_KEYWORDS });
  }

  if (req.method === "POST" && pathname === "/api/auth/register") {
    const { name, email, password } = await readRequestBody(req);
    if (!String(name || "").trim() || !/^\S+@\S+\.\S+$/.test(String(email || ""))) {
      throw new HttpError(400, "Name and a valid email are required.");
    }
    if (String(password || "").length < 8) throw new HttpError(400, "Password must be at least 8 characters.");
    const normalizedEmail = String(email).trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      throw new HttpError(409, "That email is already registered.");
    }
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: await bcrypt.hash(String(password), 12)
    });
    issueCookie(res, user._id);
    return jsonResponse(res, 201, { user: publicUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const { email, password } = await readRequestBody(req);
    const normalizedEmail = String(email || "").trim().toLowerCase();
    checkLoginRate(`${req.socket.remoteAddress}:${normalizedEmail}`);
    const user = await User.findOne({ email: normalizedEmail });
    const valid = user && (await bcrypt.compare(String(password || ""), user.passwordHash));
    if (!valid) throw new HttpError(401, "Invalid email or password.");
    issueCookie(res, user._id);
    return jsonResponse(res, 200, { user: publicUser(user) });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    clearCookie(res);
    return jsonResponse(res, 200, { ok: true });
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const user = await getUser(req);
    if (!user) throw new HttpError(401, "Not signed in.");
    return jsonResponse(res, 200, { user: publicUser(user) });
  }

  // ---------- Protected routes: everything below needs a signed-in user ----------
  const user = await getUser(req);
  if (!user) throw new HttpError(401, "Please sign in.");
  const owner = user._id;

  if (req.method === "GET" && pathname === "/api/shortlist") {
    return jsonResponse(res, 200, { shortlist: await listEvaluations(owner) });
  }

  if (req.method === "POST" && pathname === "/api/evaluate") {
    const body = await readRequestBody(req);
    const evaluation = await evaluateCandidate(body.candidate || body);
    const saved = await upsertEvaluation(evaluation, owner);
    return jsonResponse(res, 200, { evaluation: saved, shortlist: await listEvaluations(owner) });
  }

  const candidateMatch = pathname.match(/^\/api\/candidates\/([^/]+)$/);
  if (candidateMatch) {
    const id = decodeURIComponent(candidateMatch[1]);
    const found = mongoose.isValidObjectId(id) ? await Evaluation.findOne({ _id: id, owner }) : null;
    if (!found) throw new HttpError(404, "Candidate not found.");
    if (req.method === "GET") return jsonResponse(res, 200, { evaluation: found.toJSON() });
    if (req.method === "DELETE") {
      await found.deleteOne();
      return jsonResponse(res, 200, { shortlist: await listEvaluations(owner) });
    }
  }

  if (req.method === "DELETE" && pathname === "/api/shortlist") {
    await Evaluation.deleteMany({ owner });
    return jsonResponse(res, 200, { shortlist: [] });
  }

  return jsonResponse(res, 404, { error: "API route not found." });
}

async function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const resolvedPath = path.normalize(path.join(STATIC_ROOT, safePath));

  if (!resolvedPath.startsWith(STATIC_ROOT)) {
    return textResponse(res, 403, "Forbidden");
  }

  try {
    const file = await fs.readFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    res.end(file);
  } catch {
    if (!pathname.startsWith("/api/")) {
      try {
        const appShell = await fs.readFile(path.join(STATIC_ROOT, "index.html"));
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache"
        });
        res.end(appShell);
        return;
      } catch {
        textResponse(res, 404, "Not found");
        return;
      }
    }
    textResponse(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  try {
    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(req, res, requestUrl.pathname);
      return;
    }

    await serveStatic(req, res, decodeURIComponent(requestUrl.pathname));
  } catch (error) {
    jsonResponse(res, error.status || 500, { error: error.message || "Internal server error." });
  }
});

async function start() {
  if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set. Add it to your .env file.");
  await connectDb();
  server.listen(PORT, () => {
    console.log(`EvalFlow full-stack app running at http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Startup failed:", error.message);
  process.exit(1);
});