import { useEffect, useMemo, useRef, useState } from "react";

function CustomCursor() {
  const dotRef  = useRef(null);
  const ringRef = useRef(null);
  const pos     = useRef({ x: -200, y: -200 });
  const ring    = useRef({ x: -200, y: -200 });
  const raf     = useRef(null);

  useEffect(() => {
    const onMove = (e) => { pos.current = { x: e.clientX, y: e.clientY }; };

    const onEnter = () => {
      dotRef.current?.classList.add("hovering");
      ringRef.current?.classList.add("hovering");
    };
    const onLeave = () => {
      dotRef.current?.classList.remove("hovering");
      ringRef.current?.classList.remove("hovering");
    };

    const interactable = "button, a, input, select, textarea, label, [role='button']";
    document.querySelectorAll(interactable).forEach((el) => {
      el.addEventListener("mouseenter", onEnter);
      el.addEventListener("mouseleave", onLeave);
    });

    const observer = new MutationObserver(() => {
      document.querySelectorAll(interactable).forEach((el) => {
        el.removeEventListener("mouseenter", onEnter);
        el.removeEventListener("mouseleave", onLeave);
        el.addEventListener("mouseenter", onEnter);
        el.addEventListener("mouseleave", onLeave);
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });

    function animate() {
      if (dotRef.current) {
        dotRef.current.style.left = `${pos.current.x}px`;
        dotRef.current.style.top  = `${pos.current.y}px`;
      }
      if (ringRef.current) {
        ring.current.x += (pos.current.x - ring.current.x) * 0.14;
        ring.current.y += (pos.current.y - ring.current.y) * 0.14;
        ringRef.current.style.left = `${ring.current.x}px`;
        ringRef.current.style.top  = `${ring.current.y}px`;
      }
      raf.current = requestAnimationFrame(animate);
    }

    document.addEventListener("mousemove", onMove);
    raf.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf.current);
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <div ref={dotRef}  className="cursor-dot"  aria-hidden="true" />
      <div ref={ringRef} className="cursor-ring" aria-hidden="true" />
    </>
  );
}

const ROLE_KEYWORDS = {
  "Frontend Engineer": ["react", "typescript", "javascript", "accessibility", "performance", "css", "ui", "testing"],
  "Full Stack Engineer": ["react", "typescript", "node", "api", "postgresql", "cloud", "testing", "ci/cd"],
  "Backend Engineer": ["node", "api", "database", "postgresql", "distributed", "cloud", "testing", "security"],
  "Data Engineer": ["python", "sql", "pipeline", "spark", "warehouse", "etl", "airflow", "cloud"],
  "ML Engineer": ["python", "model", "ml", "pytorch", "tensorflow", "data", "deployment", "evaluation"]
};

const initialCandidate = {
  name: "Aarav Sharma",
  role: "Full Stack Engineer",
  githubUser: "gaearon",
  leetcodeUser: "aarav_codes",
  leetcodeSolved: 427,
  leetcodeAcceptance: 71,
  resumeText:
    "Full stack engineer with 4 years of experience building React, TypeScript, Node.js, PostgreSQL, and cloud-native products. Led dashboard performance work, built API services, designed CI/CD workflows, and collaborated with product teams on analytics, accessibility, testing, and developer tooling."
};

const sampleEvaluation = {
  candidate: initialCandidate,
  github: {
    repos: 108,
    stars: 15200,
    followers: 76000,
    publicProfile: true,
    languages: ["JavaScript", "TypeScript", "HTML", "CSS"],
    source: "sample"
  },
  scores: {
    overall: 86,
    github: 82,
    leetcode: 88,
    resume: 90,
    competencies: {
      "Code Craft": 84,
      Systems: 78,
      "Problem Solving": 88,
      "Product Sense": 86,
      Communication: 91,
      Reliability: 82
    }
  },
  recommendation: "Advance to technical screen",
  matchedKeywords: ["react", "typescript", "node", "api", "postgresql", "cloud", "testing", "ci/cd"],
  ai: {
    model: "transparent-rubric-v1",
    summary: "Aarav Sharma is an advance to technical screen candidate for Full Stack Engineer. Strongest signal: Communication.",
    strengths: [
      "90/100 resume match with 8 role keywords detected",
      "88/100 problem-solving score from 427 solved problems",
      "82/100 GitHub score from public profile evidence"
    ],
    risks: ["Validate depth during the technical screen."]
  },
  warnings: [],
  evaluatedAt: new Date().toISOString()
};

function compactNumber(value) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(value || 0));
}

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function labelFor(score, type) {
  const strong = {
    overall: "Strong match",
    github: "Consistent builder",
    leetcode: "Interview-ready",
    resume: "Role aligned"
  };
  const medium = {
    overall: "Needs review",
    github: "Moderate footprint",
    leetcode: "Developing",
    resume: "Partial match"
  };
  const low = {
    overall: "Risky match",
    github: "Limited evidence",
    leetcode: "Needs practice",
    resume: "Weak match"
  };
  if (score >= 80) return strong[type];
  if (score >= 65) return medium[type];
  return low[type];
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

export default function App() {
  const [candidate, setCandidate] = useState(initialCandidate);
  const [evaluation, setEvaluation] = useState(sampleEvaluation);
  const [shortlist, setShortlist] = useState([]);
  const [status, setStatus] = useState("Ready");
  const [toast, setToast] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    let alive = true;

    apiRequest("/api/shortlist")
      .then((payload) => {
        if (!alive) return;
        setShortlist(payload.shortlist);
        if (payload.shortlist.length) {
          setEvaluation(payload.shortlist[0]);
          setCandidate(payload.shortlist[0].candidate);
        }
      })
      .catch(() => {
        setShortlist([sampleEvaluation]);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeRows = shortlist.length ? shortlist : [evaluation];

  function updateCandidate(field, value) {
    setCandidate((current) => ({
      ...current,
      [field]: field === "leetcodeSolved" || field === "leetcodeAcceptance" ? Number(value || 0) : value
    }));
  }

  async function runEvaluation(nextCandidate = candidate) {
    setStatus("Analyzing");
    setIsEvaluating(true);

    try {
      const payload = await apiRequest("/api/evaluate", {
        method: "POST",
        body: JSON.stringify({ candidate: nextCandidate })
      });
      setEvaluation(payload.evaluation);
      setShortlist(payload.shortlist);
      setCandidate(payload.evaluation.candidate);
      setStatus("Complete");
      setToast(payload.evaluation.warnings?.[0] ? `${payload.evaluation.warnings[0]} Fallback evidence used.` : "Evaluation saved to backend shortlist.");
    } catch (error) {
      setStatus("Offline");
      setToast(`Backend unavailable: ${error.message}`);
    } finally {
      setIsEvaluating(false);
    }
  }

  function loadSample() {
    const sample = {
      name: "Nisha Rao",
      role: "Frontend Engineer",
      githubUser: "yyx990803",
      leetcodeUser: "nisha_frontend",
      leetcodeSolved: 312,
      leetcodeAcceptance: 76,
      resumeText:
        "Frontend engineer with 5 years building React, TypeScript, accessibility systems, design tooling, component libraries, CSS architecture, performance dashboards, automated testing, and product analytics. Led cross-functional launches and mentored junior engineers."
    };
    setCandidate(sample);
    runEvaluation(sample);
  }

  async function importResume(event) {
    const [file] = event.target.files;
    if (!file) return;
    const resumeText = await file.text();
    setCandidate((current) => ({ ...current, resumeText }));
    setToast("Resume text imported.");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ ...evaluation, exportedAt: new Date().toISOString() }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${evaluation.candidate.name.replace(/\s+/g, "-").toLowerCase()}-evaluation.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={isEvaluating ? "is-evaluating" : ""}>
      <CustomCursor />
      <div className="app-shell">
        <Sidebar score={evaluation.scores.overall} />

        <main className="workspace">
          <Topbar isEvaluating={isEvaluating} onRun={() => runEvaluation()} onSample={loadSample} evaluation={evaluation} />
          <Metrics scores={evaluation.scores} />

          <section className="content-grid">
            <CandidateForm
              candidate={candidate}
              status={status}
              onChange={updateCandidate}
              onResumeFile={importResume}
            />
            <CandidateCard evaluation={evaluation} />
          </section>

          <section id="signals" className="analysis-layout">
            <Signals evaluation={evaluation} />
            <Heatmap competencies={evaluation.scores.competencies} />
          </section>

          <Shortlist rows={activeRows} onExport={exportJson} />
        </main>
      </div>

      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}

function Sidebar({ score }) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="presentation" focusable="false" aria-hidden="true">
            <path
              d="M4.75 7.25C4.75 5.96 5.79 4.92 7.08 4.92h9.84c1.29 0 2.33 1.04 2.33 2.33v9.56c0 1.29-1.04 2.33-2.33 2.33H7.08c-1.29 0-2.33-1.04-2.33-2.33V7.25Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.55"
            />
            <path
              d="M9.1 10.85a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
            <path
              d="M10.75 12.35 12.35 13.95"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.7"
            />
            <path
              d="M13 8.1h4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.55"
            />
            <path
              d="M13 11.1h2.65"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.55"
            />
            <path
              d="M13 14.1h3.25"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.55"
            />
          </svg>
        </div>
        <div>
          <strong>EvalFlow</strong>
          <span>Recruiter workspace</span>
        </div>
      </div>

      <nav className="nav-list">
        <a href="#dashboard" className="nav-item active">Dashboard</a>
        <a href="#candidate" className="nav-item">Candidate</a>
        <a href="#signals" className="nav-item">Signals</a>
        <a href="#shortlist" className="nav-item">Shortlist</a>
      </nav>

      <div className="sidebar-panel">
        <span className="eyebrow">Pipeline pulse</span>
        <strong>{score}%</strong>
        <p>average technical confidence across active candidates</p>
      </div>
    </aside>
  );
}

function Topbar({ isEvaluating, onRun, onSample, evaluation }) {
  return (
    <header className="topbar panel hero-panel">
      <div className="hero-copy">
        <span className="eyebrow">Executive hiring intelligence</span>
        <h1>Premium hiring dashboards for teams that need live signals, sharper context, and faster decisions.</h1>
        <p>
          EvalFlow turns GitHub, LeetCode, and resume evidence into a clear decision layer with deep gradients, live
          motion, and a presentation-ready layout.
        </p>
        <div className="hero-actions">
          <button className="primary-btn" onClick={onRun} disabled={isEvaluating}>
            {isEvaluating ? "Scanning live..." : "Open live review"}
          </button>
          <button className="secondary-btn" onClick={onSample}>
            Load curated sample
          </button>
        </div>
        <div className="hero-stats" aria-label="Live overview">
          <div>
            <strong>{evaluation.scores.overall}</strong>
            <span>Overall fit</span>
          </div>
          <div>
            <strong>{evaluation.scores.github}</strong>
            <span>Technical signal</span>
          </div>
          <div>
            <strong>{evaluation.scores.leetcode}</strong>
            <span>Coding depth</span>
          </div>
        </div>
        <div className="hero-strip" aria-label="Live signal strip">
          <span>
            <i />
            GitHub <strong>{evaluation.scores.github}</strong>
          </span>
          <span>
            <i />
            LeetCode <strong>{evaluation.scores.leetcode}</strong>
          </span>
          <span>
            <i />
            Resume <strong>{evaluation.scores.resume}</strong>
          </span>
        </div>
      </div>

      <div className="hero-visual" aria-hidden="true">
        <div className="hero-card hero-card-main">
          <div className="hero-card-top">
            <span className="live-chip">Live board</span>
            <b>86</b>
          </div>
          <div className="hero-image hero-image-main" />
          <div className="hero-card-bottom">
            <span>Presentation-ready workflow</span>
            <small>Signals update instantly as the candidate profile changes.</small>
          </div>
        </div>
        <div className="hero-card hero-card-small hero-card-a">
          <div className="hero-image hero-image-a" />
          <span>Decision path</span>
        </div>
        <div className="hero-card hero-card-small hero-card-b">
          <div className="hero-image hero-image-b" />
          <span>Evidence stack</span>
        </div>
      </div>
    </header>
  );
}

function Metrics({ scores }) {
  const metrics = [
    ["overall", "Overall Fit", "metric-overall"],
    ["github", "GitHub Health", "metric-github"],
    ["leetcode", "Problem Solving", "metric-leetcode"],
    ["resume", "Resume Match", "metric-resume"]
  ];

  return (
    <section id="dashboard" className="metrics-grid" aria-label="Recruiter dashboard metrics">
      {metrics.map(([key, title, className], index) => (
        <article className={`metric ${className}`} key={key} style={{ animationDelay: `${160 + index * 60}ms` }}>
          <span>{title}</span>
          <strong>{scores[key]}</strong>
          <small>{labelFor(scores[key], key)}</small>
          <div className="metric-track" aria-hidden="true">
            <i style={{ width: `${scores[key]}%` }} />
          </div>
        </article>
      ))}
    </section>
  );
}

function CandidateForm({ candidate, status, onChange, onResumeFile }) {
  return (
    <section id="candidate" className="panel intake-panel" aria-labelledby="candidateTitle">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Candidate intake</span>
          <h2 id="candidateTitle">Candidate profile</h2>
        </div>
        <span className="status-pill" data-state={status.toLowerCase()}>{status}</span>
      </div>

      <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
        <label>
          Candidate name
          <input value={candidate.name} type="text" autoComplete="name" onChange={(event) => onChange("name", event.target.value)} />
        </label>
        <label>
          Target role
          <select value={candidate.role} onChange={(event) => onChange("role", event.target.value)}>
            {Object.keys(ROLE_KEYWORDS).map((role) => (
              <option key={role}>{role}</option>
            ))}
          </select>
        </label>
        <label>
          GitHub username
          <input value={candidate.githubUser} type="text" autoComplete="off" onChange={(event) => onChange("githubUser", event.target.value)} />
        </label>
        <label>
          LeetCode username
          <input value={candidate.leetcodeUser} type="text" autoComplete="off" onChange={(event) => onChange("leetcodeUser", event.target.value)} />
        </label>
        <label>
          LeetCode solved
          <input value={candidate.leetcodeSolved} type="number" min="0" onChange={(event) => onChange("leetcodeSolved", event.target.value)} />
        </label>
        <label>
          Acceptance rate
          <input value={candidate.leetcodeAcceptance} type="number" min="0" max="100" onChange={(event) => onChange("leetcodeAcceptance", event.target.value)} />
        </label>
        <label className="wide-field">
          Resume text or pasted summary
          <textarea value={candidate.resumeText} rows="7" onChange={(event) => onChange("resumeText", event.target.value)} />
        </label>
        <label className="file-drop wide-field">
          <input type="file" accept=".txt,.md,.csv,.json" onChange={onResumeFile} />
          <span>Import resume packet</span>
          <small>TXT, MD, CSV, or JSON. PDF parsing can be connected later through a backend extractor.</small>
        </label>
      </form>
    </section>
  );
}

function CandidateCard({ evaluation }) {
  const { candidate, github, scores, recommendation, ai } = evaluation;
  const tags = useMemo(() => {
    const fallback = ROLE_KEYWORDS[candidate.role]?.slice(0, 4) || [];
    return [...new Set([...(github.languages || []), ...fallback])].slice(0, 6);
  }, [candidate.role, github.languages]);

  return (
    <section className="panel candidate-card" aria-labelledby="profileTitle">
      <div className="candidate-visual">
        <div className="avatar">{initials(candidate.name)}</div>
        <div className="score-ring" aria-label="Overall score">
          <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
            <circle className="ring-track" cx="60" cy="60" r="52" />
            <circle className="ring-fill" cx="60" cy="60" r="52" style={{ strokeDashoffset: 327 - (327 * scores.overall) / 100 }} />
          </svg>
          <strong>{scores.overall}</strong>
        </div>
      </div>
      <h2 id="profileTitle">{candidate.name}</h2>
      <p>{ai?.summary || `${candidate.role} candidate evaluation.`}</p>
      <div className="profile-meta" aria-label="Candidate source handles">
        <span>GitHub: {candidate.githubUser || "not provided"}</span>
        <span>LeetCode: {candidate.leetcodeUser || "not provided"}</span>
      </div>
      <div className="tag-row">
        {tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
      <div className="candidate-showcase" aria-hidden="true">
        <div className="showcase-image showcase-a" />
        <div className="showcase-image showcase-b" />
        <div className="showcase-image showcase-c" />
      </div>
      <div className="evidence-grid">
        <Evidence label="Repos" value={compactNumber(github.repos)} />
        <Evidence label="Stars" value={compactNumber(github.stars)} />
        <Evidence label="Solved" value={compactNumber(candidate.leetcodeSolved)} />
      </div>
      <div className="decision-box">
        <span>Recruiter decision</span>
        <strong>{recommendation}</strong>
      </div>
    </section>
  );
}

function Evidence({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Signals({ evaluation }) {
  const { candidate, github, scores, matchedKeywords, ai, recommendation } = evaluation;
  const signals = [
    {
      label: "Backend evaluation",
      value: scores.overall,
      detail: `${ai?.model || "server-rubric"} produced a ${recommendation.toLowerCase()} recommendation`
    },
    {
      label: "GitHub evidence",
      value: scores.github,
      detail:
        github.source === "github"
          ? `${github.repos} public repos, ${github.stars} recent repo stars, ${github.followers} followers`
          : "Fallback profile used; verify GitHub username for final screening"
    },
    {
      label: "LeetCode evidence",
      value: scores.leetcode,
      detail: `${candidate.leetcodeSolved} solved problems with ${candidate.leetcodeAcceptance}% acceptance`
    },
    {
      label: "Resume evidence",
      value: scores.resume,
      detail: `${(matchedKeywords || []).length} role keywords detected for ${candidate.role}`
    }
  ];

  return (
    <section className="panel" aria-labelledby="signalTitle">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Evidence</span>
          <h2 id="signalTitle">Scoring signals</h2>
        </div>
      </div>
      <div className="signal-list">
        {signals.map((signal) => (
          <article className="signal" key={signal.label}>
            <div>
              <strong>{signal.label}</strong>
              <span>{signal.detail}</span>
            </div>
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${signal.value}%` }} />
            </div>
            <b>{signal.value}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function Heatmap({ competencies }) {
  return (
    <section className="panel" aria-labelledby="radarTitle">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Scorecard</span>
          <h2 id="radarTitle">Competency heatmap</h2>
        </div>
      </div>
      <div className="heatmap">
        {Object.entries(competencies).map(([label, score]) => (
          <div className="heat-cell" style={{ "--score": score }} key={label}>
            <span>{label}</span>
            <strong>{score}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Shortlist({ rows, onExport }) {
  return (
    <section id="shortlist" className="panel shortlist-panel" aria-labelledby="shortlistTitle">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Recruiter operations</span>
          <h2 id="shortlistTitle">Pipeline shortlist</h2>
        </div>
        <button className="secondary-btn" onClick={onExport}>Export JSON</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Role</th>
              <th>Overall</th>
              <th>GitHub</th>
              <th>LeetCode</th>
              <th>Resume</th>
              <th>Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id || item.candidate.name}>
                <td>{item.candidate.name}</td>
                <td>{item.candidate.role}</td>
                <td><strong>{item.scores.overall}</strong></td>
                <td>{item.scores.github}</td>
                <td>{item.scores.leetcode}</td>
                <td>{item.scores.resume}</td>
                <td><span className="table-pill">{item.recommendation}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
