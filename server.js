const http = require("node:http");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const STATIC_ROOT = fsSync.existsSync(path.join(ROOT, "dist")) ? path.join(ROOT, "dist") : ROOT;
const DATA_DIR = path.join(ROOT, "data");
const SHORTLIST_FILE = path.join(DATA_DIR, "shortlist.json");

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
  return body ? JSON.parse(body) : {};
}

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SHORTLIST_FILE);
  } catch {
    await fs.writeFile(SHORTLIST_FILE, "[]\n", "utf8");
  }
}

async function readShortlist() {
  await ensureDataFile();
  const raw = await fs.readFile(SHORTLIST_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeShortlist(rows) {
  await ensureDataFile();
  await fs.writeFile(SHORTLIST_FILE, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
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
    id: `${candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`,
    candidate,
    github,
    scores,
    recommendation: recommendation(scores.overall),
    matchedKeywords: keywords,
    ai: buildAiSummary(candidate, scores, github, keywords),
    warnings: githubWarning ? [githubWarning] : [],
    evaluatedAt: new Date().toISOString()
  };
}

async function upsertEvaluation(evaluation) {
  const rows = await readShortlist();
  const key = evaluation.candidate.name.toLowerCase();
  const existingIndex = rows.findIndex((row) => row.candidate.name.toLowerCase() === key);
  const nextRows = existingIndex >= 0 ? [...rows.slice(0, existingIndex), evaluation, ...rows.slice(existingIndex + 1)] : [evaluation, ...rows];
  await writeShortlist(nextRows.slice(0, 50));
  return nextRows.slice(0, 50);
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    return jsonResponse(res, 200, { ok: true, service: "EvalFlow API", timestamp: new Date().toISOString() });
  }

  if (req.method === "GET" && pathname === "/api/roles") {
    return jsonResponse(res, 200, { roles: Object.keys(ROLE_KEYWORDS), roleKeywords: ROLE_KEYWORDS });
  }

  if (req.method === "GET" && pathname === "/api/shortlist") {
    return jsonResponse(res, 200, { shortlist: await readShortlist() });
  }

  if (req.method === "POST" && pathname === "/api/evaluate") {
    const body = await readRequestBody(req);
    const evaluation = await evaluateCandidate(body.candidate || body);
    const shortlist = await upsertEvaluation(evaluation);
    return jsonResponse(res, 200, { evaluation, shortlist });
  }

  if (req.method === "DELETE" && pathname === "/api/shortlist") {
    await writeShortlist([]);
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
    jsonResponse(res, 500, { error: error.message || "Internal server error." });
  }
});

server.listen(PORT, () => {
  console.log(`EvalFlow full-stack app running at http://localhost:${PORT}`);
});
