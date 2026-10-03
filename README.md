# EvalFlow - Full-Stack Developer Evaluation Workflow

EvalFlow is a full-stack recruiter dashboard for evaluating developer candidates from GitHub, LeetCode, and resume evidence.

## Stack

- Frontend: React + Vite
- Backend: Node.js HTTP server
- Storage: local JSON file at `data/shortlist.json`
- External enrichment: GitHub public API from the backend

## Features

- Candidate intake for target role, GitHub username, LeetCode stats, and resume text.
- Backend scoring API for GitHub, LeetCode, resume, overall fit, and competency heatmap.
- Server-side GitHub profile enrichment with fallback evidence if GitHub is unavailable.
- Persistent recruiter shortlist saved locally.
- AI-style transparent rubric summary with strengths, risks, and recommendation.
- JSON export from the dashboard.
- Professional responsive recruiter UI.
- **Recruitment potential heatmap**: after the intake form is submitted, the backend scores the candidate against every role (resume fit, GitHub, LeetCode, overall) and the UI renders a colour-coded role x signal heatmap with an estimated chance of being recruited.
- Input validation (400 errors) and per-candidate view/remove from the shortlist.

## Run

Install dependencies:

```bash
npm install
```

Development mode needs the API server and Vite UI server in separate terminals:

```bash
npm run api
```

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

Production build:

```bash
npm run build
npm start
```

Then open:

```text
http://localhost:3000
```

## Scripts

```bash
npm start
npm run api
npm run dev
npm run build
npm run check
```

## API

```text
GET    /api/health
GET    /api/roles
GET    /api/shortlist
POST   /api/evaluate          -> { evaluation, shortlist }  (evaluation.potential drives the heatmap)
GET    /api/candidates/:id
DELETE /api/candidates/:id
DELETE /api/shortlist
```

Example evaluation payload:

```json
{
  "candidate": {
    "name": "Aarav Sharma",
    "role": "Full Stack Engineer",
    "githubUser": "gaearon",
    "leetcodeUser": "aarav_codes",
    "leetcodeSolved": 427,
    "leetcodeAcceptance": 71,
    "resumeText": "React, TypeScript, Node.js, PostgreSQL, cloud, testing..."
  }
}
```

## Project layout

```text
backend/server.js   Node API + static server (serves dist/ after a build)
src/                React app (App.jsx, main.jsx)
frontend/styles.css Global styles
data/shortlist.json Persisted evaluations
```

## Production Notes

- Add authentication before using this with real candidate data.
- Move `data/shortlist.json` to PostgreSQL, MongoDB, or another durable database for team usage.
- Add a backend PDF parser for resume uploads.
- Replace or augment `transparent-rubric-v1` with an AI service if you need natural-language resume reasoning at scale.
- Add rate limiting and caching for GitHub API calls.
