# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Backend (FastAPI, Python 3.12 in CI, 3.10+ per README) — run from `backend/`:

```powershell
python -m venv venv                      # venv lives at backend/venv (gitignored)
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
ruff check .                             # lint (config: backend/pyproject.toml)
ruff format . --check                    # format check (README only; not run in CI)
pytest                                   # full suite (testpaths = tests)
pytest tests/test_agents.py              # one file
pytest tests/test_products.py::test_create_and_get_product   # one test
uvicorn app.main:app --reload --port 8000
```

Frontend (React + Vite + Tailwind) — run from `frontend/`:

```powershell
npm ci
npm run lint                             # ESLint flat config over the whole frontend
npm run build                            # CI runs this; catches broken imports/JSX
npm run dev                              # http://localhost:5173
```

CI (`.github/workflows/ci.yml`) runs on push to `main` and on PRs: `ruff check .` and `pytest` in `backend/`, then `npm run lint` and `npm run build` in `frontend/`. A green local run of those four commands matches CI.

## Configuration

- Copy `.env.example` to `.env` at the repo root. Real values never go in git.
- `backend/app/database.py` calls `load_dotenv()`, which finds the root `.env` by walking up from the module. But `Settings` in `backend/app/config.py` uses `env_file=".env"`, which resolves against the current working directory. Running uvicorn from `backend/` therefore reads `backend/.env`, not the root one. Settings also read `os.getenv` at import time, so values must be present before `app.config` is imported.
- Without `DATABASE_URL`, `/health` returns 503 and every product endpoint fails (`get_db` raises).
- Without `OPENAI_API_KEY` (or with a placeholder value such as `changeme`), the agents use deterministic heuristic fallbacks instead of calling OpenAI. The `source` field in the logs reflects which path ran.
- `CORS_ORIGINS` is a comma-separated list. Any `https://*.vercel.app` origin is also allowed by regex in `main.py`.

## Testing notes

- Tests use in-memory SQLite (`sqlite:///:memory:` with `StaticPool`) and override `get_db` per test module. Each module repeats this setup rather than sharing a `conftest.py`.
- `test_agents.py` has an autouse `no_live_api` fixture that monkeypatches the OpenAI client, so the suite never makes billable calls. Keep new agent tests on that pattern.
- `test_rate_limit.py` and `test_agents.py` reset `limiter` between tests. Rate-limit state leaks between tests otherwise.
- Schema changes need a migration path: `init_db()` runs `create_all` and then hand-written `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for `product_analyses` (PostgreSQL) or a PRAGMA-style column check (SQLite). There is no Alembic.

## Architecture

### Backend: one app module, one agent pipeline

- `backend/app/main.py` holds every route. There are no APIRouters. The `/api/v1/...` and singular `generate-listing` paths are hidden duplicates (`include_in_schema=False`) of the documented routes. Keep them in sync if you change behaviour.
- Data model (`app/models.py`): `Product` 1—1 `ProductAnalysis` and 1—N `ProductListing`, all with cascade delete. `ProductAnalysis` stores Agent 1 output plus `market_insights` (Agent 2) and `execution_logs` (JSON array shared by all three agents). `Product.status` moves `draft` → `analyzed` → `completed`.
- Pipeline (`full-pipeline` in `main.py`) calls the three endpoint functions directly as Python functions, in order: Agent 1 → Agent 2 → Agent 3. Each step first runs its predecessor if the data is missing. Calling the functions directly rather than over HTTP means the rate-limit decorator still applies to the inner call.
- Re-running an agent replaces only its own log entries. Each log entry carries an `agent` prefix (`"Agent 2 …"`, `"Agent 3 …"`), and the reruns filter on that prefix before appending. Keep that prefix convention if you add log lines.
- Agent 1 (`agents/product_analyzer.py`) is the structuring step and includes heuristic category/audience inference. Agents 2 and 3 are the LLM-backed ones.
- Agents 2 and 3 share `agents/validation.py::call_agent`. It sends a strict JSON-schema chat completion (schema derived from the pydantic model via `strict_schema`, which strips unsupported keywords and forces `additionalProperties: false`), then applies three gates in order: pydantic schema, claim rules (regexes such as "waterproof" or "FDA" that must be supported by seller-provided text in the corpus), and agent-specific grounding checks. On rejection it retries once (`MAX_ATTEMPTS = 2`), feeding the violations back to the model. The per-attempt events are kept and rendered into the execution logs, so gate decisions are visible in the UI. A new guardrail belongs in these gates, not in the endpoint code.
- Agent 3 (`agents/listing_generator.py`) must return exactly one listing per platform in `PLATFORMS = (shopee, tiktok, lazada)`. Its `ListingBundle` validator enforces this. Its prompt forbids new product facts, so only rephrasing of Agent 1 and 2 output is allowed.
- Rate limiting: `limiter` (slowapi, keyed by client IP) applies only to the two generation endpoints (`generate-listings` and `full-pipeline`), with the limit from `RATE_LIMIT_GENERATE_LISTING` (default `5/minute`). Other routes are unlimited.
- Error handling: a middleware and a global exception handler both return 500 JSON with `error`, `detail`, and `type`. Both let `HTTPException` and `RateLimitExceeded` through.

### Frontend: one large component

- `frontend/src/App.jsx` (~1750 lines) holds all app state and the API calls. It has two tabs, `assistant` (product form, pipeline controls, results) and `devops` (polls `GET /health`). The API base is `VITE_API_URL`, defaulting to `http://localhost:8000`.
- Presentational pieces live in `src/components/`: `ListingPreview`, `MarketStrategyCard`, and `AgentLogsConsole`. They receive data through props from `App.jsx` and do not fetch.
- `SAMPLE_PRODUCTS` at the top of `App.jsx` is demo seed data for the form. It is not fetched from the backend.

### Deployment

- Backend deploys to Render using `render.yaml` (`rootDir: backend`, `startCommand` uses `$PORT`, health check `/health`). Env vars are `sync: false`, so they must be set in the Render dashboard.
- Frontend deployment (Vercel, per the docs) is not configured in the repo.

## Docs that are out of date

`docs/SYSTEM_ARCHITECTURE.md` describes JWT authentication, Server-Sent Events streaming, and an async `/api/v1` router. None of these exist in the code: `grep` for `jwt`, `EventSource`, or `StreamingResponse` in `backend/app` and `frontend/src` finds nothing, and the only `/api/v1` routes are the hidden aliases in `main.py`. The repository-structure tree in `README.md` is also stale (it lists only the health-check files). Verify against the code before relying on either document.
