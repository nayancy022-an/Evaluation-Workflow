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

## Project Flowchart

- <img width="8206" height="6775" alt="diagram" src="https://github.com/user-attachments/assets/34e9db7c-c255-46ea-a110-0652d2a7dc83" />


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
POST   /api/evaluate
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

## Production Notes

- Add authentication before using this with real candidate data.
- Move `data/shortlist.json` to PostgreSQL, MongoDB, or another durable database for team usage.
- Add a backend PDF parser for resume uploads.
- Replace or augment `transparent-rubric-v1` with an AI service if you need natural-language resume reasoning at scale.
- Add rate limiting and caching for GitHub API calls.
