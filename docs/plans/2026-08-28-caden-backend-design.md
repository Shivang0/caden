# caden backend design (hackathon scope)

Date: 2026-08-28. Approved direction from chat: same Vercel project, visible multi-agent pipeline, Claude Opus 4.8 for all agents, user provides ANTHROPIC_API_KEY via Vercel env.

## What it does

Paste a public GitHub repo + date range + optional pasted metrics. A pipeline of agents turns real merged PRs, commits and releases into three artifacts: investor update, build in public posts (LinkedIn + X), changelog. Everything streams live to the page.

## Architecture

- Static site + `api/` serverless functions in the existing `demo-web/` Vercel project (`caden`).
- `api/generate.js` (Node runtime, response streaming on, maxDuration 300):
  1. Parse {repo, from, to, metrics} from POST body.
  2. Fetch GitHub data (REST, no OAuth): repo meta, merged PRs in range (search API), commits in range, releases in range. Optional `GITHUB_TOKEN` env raises rate limits.
  3. Summarizer agent (Opus 4.8, adaptive thinking): builds a work map from the raw data. Streamed to the client as its own panel.
  4. Three writer agents run in parallel (Opus 4.8), each streaming deltas tagged by artifact: `investor_update`, `posts`, `changelog`. Metrics are folded in verbatim; writers may not invent numbers.
  5. SSE protocol over fetch streaming: `stage`, `delta`, `artifact_done`, `done`, `error` events.
- `/app.html`: caden-styled demo page. Form (repo, date range, metrics box), agent status rail, four streaming panels with copy buttons.
- Nav on the landing page links to the live demo.

## Guardrails

- Grounding rules in every prompt: no invented numbers, every claim traces to a PR/commit/release, metrics only from the founder's pasted text.
- caden voice rules enforced in prompts: short sentences, no em or en dashes, no slop vocabulary.
- Input caps: 60 PRs (bodies truncated to 600 chars), 200 commits (first lines), 20 releases (bodies truncated). Keeps input tokens bounded.
- Errors surface as SSE `error` events with readable messages (repo not found, rate limited, no activity in range).

## Env

- `ANTHROPIC_API_KEY` (required, user adds via `vercel env add`)
- `GITHUB_TOKEN` (optional, classic token with public_repo read; raises GitHub rate limits)

## Testing

Local: `vercel dev` + curl the endpoint with a small public repo and check the SSE stream. Prod: run once on a real repo after the key is added.

## Out of scope (named on the page as coming next)

OAuth, private repos, Linear/Notion sync, scheduling, voice training, auth/rate limiting on the endpoint.
