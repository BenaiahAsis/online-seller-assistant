# Online Seller Assistant — Project Context

This file is a portable overview of the repository for an AI assistant that
does not have access to the source tree. It describes the implementation found
in the code, and flags documentation claims that should be verified before
relying on them.

## What the project does

Online Seller Assistant is a full-stack web app for sellers who want to turn
basic product details into product analysis and ready-to-edit marketplace
listings. A seller supplies a name, price, quantity, optional materials, and
features or notes. The backend runs a sequential pipeline:

1. **Product Analyzer** structures the seller's input: category, audience,
   specifications, selling points, search keywords, and a summary.
2. **Market Analyzer** ranks supplied selling points, identifies likely buyer
   objections, assigns a price tier, and suggests distinct Shopee, TikTok, and
   Lazada strategies.
3. **Listing Generator** writes one listing per platform, including a title,
   description, bullets, hashtags, and call to action.

The app stores products, analyses, generated listings, and structured agent
logs in a relational database. Sellers can browse products, inspect analysis
and market strategy, preview platform-specific copy, edit listing text, and
copy it for use in a marketplace.

The product is aimed particularly at small and new online sellers. Philippine
market context appears in the UI and heuristics (for example, prices use the
₱ symbol); generated copy is not restricted to one region.

## Repository map

- `backend/app/main.py` — FastAPI app, lifecycle, CORS, health check, product,
  agent, listing, and log endpoints; orchestrates the pipeline.
- `backend/app/config.py` — central settings and environment configuration.
- `backend/app/database.py` — SQLAlchemy engine/session setup, database
  initialization, and connectivity check.
- `backend/app/models.py` — SQLAlchemy entities and relationships.
- `backend/app/schemas.py` — Pydantic request and response models.
- `backend/app/limiter.py` — SlowAPI rate limiter.
- `backend/app/agents/product_analyzer.py` — Agent 1 and deterministic product
  profile logic.
- `backend/app/agents/market_analyzer.py` — Agent 2 and fallback market
  strategy.
- `backend/app/agents/listing_generator.py` — Agent 3 and fallback listings.
- `backend/app/agents/validation.py` — shared model-output schema, grounding,
  and unsupported-claim validation and retry behavior.
- `backend/app/agents/logger.py` — structured agent execution and validation
  logs.
- `backend/tests/` — pytest tests for health/CORS, product operations, agent
  behavior, and rate limits.
- `frontend/src/App.jsx` — main React app, product form/catalog, backend health,
  and workflow orchestration.
- `frontend/src/components/ListingPreview.jsx` — platform listing preview,
  editing, and clipboard actions.
- `frontend/src/components/MarketStrategyCard.jsx` — market analysis display.
- `frontend/src/components/AgentLogsConsole.jsx` — agent log viewer and
  filtering.
- `docs/` — architecture, pipeline, onboarding, runbook, tutorials, sprint,
  incident, metrics, and optimization documentation.
- `render.yaml` — Render backend service configuration.

## Architecture and technologies

### Frontend

- React 18 single-page app, built and served in development with Vite.
- Tailwind CSS for styling; ESLint for linting.
- Uses the backend base URL from `VITE_API_URL`, defaulting to
  `http://localhost:8000`.
- The main UI has an assistant/workbench area and a system-health area. It
  includes demo product samples, product catalog selection, product and agent
  status, analysis and market-strategy views, listing platform switching,
  editing, copying, and agent logs.
- On initial load it requests `/health` and the product catalog. The UI shows
  when the hosted backend may be waking up.

### Backend

- Python FastAPI application served by Uvicorn.
- Synchronous SQLAlchemy 2.x engine and session-based database access.
- Pydantic v2 validates API payloads and agent response structures.
- OpenAI integration is configurable with `OPENAI_API_KEY` and
  `OPENAI_MODEL`; the configured model defaults to `gpt-4o-mini`.
- SlowAPI limits listing generation and full-pipeline requests to
  `5/minute` by default, keyed by remote IP.
- CORS defaults include common local development origins. The app also allows
  HTTPS subdomains of `vercel.app`.
- The backend startup lifespan calls `init_db()`, which creates missing
  tables and applies a small set of additive schema changes. No separate
  migration framework is configured in the inspected project files.

### Persistence model

- `Product` stores the seller's raw product input and a status (`draft`,
  `analyzed`, or `completed`).
- `ProductAnalysis` is a one-to-one child of `Product`. It stores category,
  target audience, specifications, selling points, keywords, market insights,
  summary, and execution logs.
- `ProductListing` is a one-to-many child of `Product`. Each generated listing
  stores its platform, title, description, bullet points, hashtags, and call
  to action.
- Foreign keys cascade deletion from a product to its analysis and listings.
- Product input validation requires a non-empty name of at most 255
  characters and a price greater than zero. Quantity defaults to 1 and must
  be at least 1. Materials are optional and limited to 500 characters;
  features/notes are optional and limited to 2,000 characters. Listing edits
  limit the title to 1-255 and the description to 1-3,000 characters.

## Agent workflow and safeguards

- Agent 1 classifies from product name and supplied details. Its local
  deterministic logic recognizes categories including wearables, audio,
  computers, mobile accessories, home, fashion, beauty, and sports; ambiguous
  items fall back to general merchandise. It also derives product attributes,
  selling points, and search terms.
- Agent 2 consumes Agent 1's profile and produces a price tier, ranked
  provided selling points, buyer objections/responses, and per-platform
  positioning. Its price tiers are based on the entered price: below ₱500 is
  “Budget-Friendly,” through ₱2,500 is “Mid-Tier Value,” and above that is
  “Premium.”
- Agent 3 produces exactly one listing for each of `shopee`, `tiktok`, and
  `lazada`. Its output contract constrains title, description, bullet, hashtag,
  and call-to-action lengths/counts.
- All three agents share validation utilities. Responses are parsed against
  Pydantic schemas and checked for unsupported claims and grounding in seller
  input or prior-agent output. The shared runner allows up to two attempts;
  deterministic fallbacks are used when AI is unavailable or output cannot
  pass validation. Agent execution logs record validation attempts, rejections,
  retries, and fallback use.
- These are application-level guardrails, not a guarantee that every
  generated statement is accurate. The seller should review output before
  publishing.

## HTTP API

Interactive OpenAPI documentation is available at `/docs` when the backend is
running.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Basic service metadata. |
| `GET` | `/health` | Runs a database `SELECT 1`; returns healthy or HTTP 503. |
| `POST` | `/api/products` | Create a product in `draft` status. |
| `GET` | `/api/products` | List products and their associated analysis/listings. |
| `GET` | `/api/products/{product_id}` | Get one product and associated data. |
| `PATCH` | `/api/products/{product_id}` | Update a product's details (only the fields sent). |
| `DELETE` | `/api/products/{product_id}` | Delete a product with its analysis and listings. |
| `POST` | `/api/products/{product_id}/analyze` | Run or refresh Agent 1; status becomes `analyzed`. |
| `POST` | `/api/products/{product_id}/market-analysis` | Run Agent 2; ensures Agent 1 has run first. |
| `POST` | `/api/products/{product_id}/generate-listings` | Run Agent 3; ensures prior analysis stages exist, replaces prior listings, and marks product `completed`. |
| `POST` | `/api/products/{product_id}/full-pipeline` | Run Agents 1 → 2 → 3 and return product plus logs. |
| `GET` | `/api/products/{product_id}/logs` | Retrieve persisted execution logs. |
| `GET` | `/api/products/{product_id}/listings` | Get a product's listings. |
| `PATCH` | `/api/listings/{listing_id}` | Update listing title, description, bullets, hashtags, or CTA. |

Compatibility aliases for listing generation and the full pipeline also exist
under `/api/v1/...`; they are hidden from the generated OpenAPI schema. The
frontend currently uses the non-versioned `/api/...` endpoints.

## Configuration and running locally

Common environment variables:

- `DATABASE_URL` — PostgreSQL connection URL. The database helper normalizes
  `postgres://` and plain `postgresql://` schemes to the psycopg2 SQLAlchemy
  driver. SQLite is used by tests.
- `OPENAI_API_KEY` — optional key for model-backed agent execution; fallbacks
  support operation without a live key.
- `OPENAI_MODEL` — model name, default `gpt-4o-mini`.
- `CORS_ORIGINS` — comma-separated allowed origins.
- `RATE_LIMIT_GENERATE_LISTING` — listing and full-pipeline limit, default
  `5/minute`.
- `VITE_API_URL` — frontend API base URL, default `http://localhost:8000`.

The backend uses `python-dotenv` and expects a local `.env` for development.
Do not put real keys in this context file or commit them to the repository.

Typical local workflow:

1. Start a PostgreSQL database and configure `DATABASE_URL`.
2. In `backend/`, install `requirements.txt`, then run
   `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
3. In `frontend/`, install npm dependencies, then run `npm run dev`.
4. Open the Vite URL (usually `http://localhost:5173`). API docs are at
   `http://localhost:8000/docs`.

Useful checks:

- Backend: from `backend/`, `pytest` and `ruff check .`.
- Frontend: from `frontend/`, `npm run lint` and `npm run build`.

The backend tests use an in-memory SQLite database and mock or remove live AI
credentials so routine tests do not need PostgreSQL or bill a real model API.

## Deployment and documentation notes

- `render.yaml` configures a Python web service rooted at `backend/`, started
  with Uvicorn, with `/health` as its health check. `OPENAI_API_KEY`,
  `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGINS` are declared as values to be
  configured outside the file.
- `docs/SYSTEM_ARCHITECTURE.md` advertises a Vercel frontend, Render backend,
  Neon PostgreSQL, and public URLs. Treat these as documentation claims, not
  live-availability checks.
- `README.md` and `docs/SYSTEM_ARCHITECTURE.md` describe the implemented system.
  Features that are planned but not built (JWT authentication, SSE streaming,
  extra platforms such as Instagram) are listed there as future work.
- `OPENAI_BASE_URL` can point the agents at an OpenAI-compatible provider, and
  `ALLOW_AI_FAILURE_SIMULATION=true` enables an `X-Simulate-AI-Failure`
  header (`api_error` or `bad_output`) for demonstrating graceful fallback.
- `docs/SPRINT_DELIVERABLES.md` includes sprint task lists that may be stale
  relative to the code. Verify any "planned," "current sprint," or completion
  claim against the implementation and tests.
- The architecture and README are useful for product intent and team
  background, but source code and tests are the authority for current runtime
  behavior.

## Guidance for an AI assistant using this context

Help improve the existing seller workflow and preserve the current stack and
patterns unless asked otherwise. Before proposing or editing code, inspect the
relevant source and tests; do not assume features mentioned only in older docs
exist. Keep AI output grounded in seller-provided facts, preserve deterministic
fallback behavior, and add or update tests for behavior changes. Do not invent
deployment state, credentials, API capabilities, or marketplace integrations.
