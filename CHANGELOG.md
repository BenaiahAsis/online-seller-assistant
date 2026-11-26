# Changelog

All notable changes to Online Seller Assistant. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-11-26

First tagged release. This is the version presented at Demo Day.

### Product
- **Products (full CRUD):** create, view, edit (`PATCH /api/products/{id}` and the **Edit Details** form), and delete, with cascade to analyses and listings. Data is stored in Neon PostgreSQL.
- **Three-agent AI pipeline:** Product Analyzer → Market Analyzer → Listing Generator. It produces one listing each for Shopee, TikTok Shop and Lazada.
- **Validation of all AI output:**
  - every agent's output goes through a strict JSON schema, a claims gate (invented warranties, certifications, health claims and so on), and grounding checks
  - one retry with the violations fed back to the model
  - a deterministic rule-based fallback if both attempts fail
- **Listing tools:** editing (title and description), copy-to-clipboard, and per-platform tabs.
- **Activity log:** a "Behind the Scenes" log showing each agent's validation decisions.
- **Interface:** plain seller-facing language; loading, empty and error states for the catalog; keyboard-accessible product cards; phone-friendly header.
- **AI failure simulation:** the `X-Simulate-AI-Failure: api_error | bad_output` header, enabled with `ALLOW_AI_FAILURE_SIMULATION`.
- **Input limits:** notes up to 2,000 characters, listing title 1–255 and description 1–3,000. Generation is rate limited to 5 requests per minute per IP.
- **Pluggable AI provider:** via `OPENAI_BASE_URL` and `OPENAI_MODEL`. Production runs Google Gemini `gemini-3.5-flash-lite`.

### Quality and evaluation
- **Tests:** 61 backend tests with mocked LLM clients, covering CRUD, the agents, validation gates, failure simulation, rate limits, and health/CORS.
- **Evaluation set** (`backend/evals`): 10 fixed products scored on acceptance checks. The first production run passed 8/10 and exposed two defects, both fixed in this release:
  - Numeric facts ("900 x 400 mm") could never be grounded, which caused needless fallbacks.
  - TikTok titles could leave out the product name; titles must now name it.

  Both have regression tests. See `backend/evals/README.md`.

### DevOps
- **CI (GitHub Actions):**
  - Ruff lint and format check
  - Pytest
  - ESLint
  - Vite build
  - gitleaks secret scan
  - parallel jobs, dependency caching, and cancellation of outdated runs
- **CD:** Render (backend) and Vercel (frontend) deploy every merge to `main`, and Vercel builds a preview for every PR.
- **Post-deploy smoke tests:** triggered by each successful production deployment.
- **Scheduled AI evaluation:** runs daily and on PRs that change agent code.
- **Docs:** pipeline, runbook, metrics, optimization and incident logs, seed script, and Python 3.12 pinned on Render.

### Known limitations
- No user accounts: every visitor sees every product. See [docs/SCOPE_CHANGES.md](docs/SCOPE_CHANGES.md).
- The free-tier backend sleeps after 15 idle minutes, and the first request can take about a minute.
- The AI provider's free tier has daily limits. When they're exceeded, agents fall back to templates.
