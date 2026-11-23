# Online Seller Assistant

A full-stack web application that helps small and new online sellers create better
product listings with less effort. Sellers enter basic product details such as name,
price, features, materials, and quantity. The app then runs them through a sequential
three-agent AI workflow:

1. **Product Analysis Agent** organizes the raw details into a structured product profile
   (category, target audience, key specs, selling points, and search keywords).
2. **Market Analysis Agent** plans how to sell it: price tier, ranked selling points,
   likely buyer concerns, and an angle for each platform.
3. **Listing Generation Agent** writes ready-to-paste listings for Shopee, TikTok Shop,
   and Lazada.

The backend validates each AI response before using it. It rejects schema errors and claims
the seller never made, such as "waterproof" or "FDA approved". If the AI is unavailable or
its output keeps failing validation, each agent falls back to a rule-based result. Products,
analyses, listings, and execution logs are stored in PostgreSQL. Sellers can review, copy,
and edit the final listings.

- **Live app:** https://online-seller-assistant-three.vercel.app
- **API docs (Swagger):** https://online-seller-assistant-backend.onrender.com/docs
- **Architecture:** [docs/SYSTEM_ARCHITECTURE.md](docs/SYSTEM_ARCHITECTURE.md)

> The backend runs on Render's free tier, so the first request after a period of
> inactivity can take up to a minute while the server wakes up.

---

## 🛠 Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | [React](https://react.dev/) + [Vite](https://vitejs.dev/) | Fast, component-driven client interface |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Modern utility-first responsive styling |
| **Frontend Tooling** | [ESLint](https://eslint.org/) | Code quality and React standards enforcement |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) | High-performance asynchronous Python API framework |
| **ORM / Database** | [SQLAlchemy 2.0](https://www.sqlalchemy.org/) + [PostgreSQL](https://www.postgresql.org/) (Neon) | Relational data models and queries |
| **Backend Tooling** | [Ruff](https://docs.astral.sh/ruff/) + [Pytest](https://docs.pytest.org/) | Lightning-fast Python linting/formatting and test automation |
| **AI Integration** | [OpenAI API](https://platform.openai.com/) (`gpt-4o-mini` by default) | Product analysis, selling strategy, and listing copy, with structured JSON output |
| **Rate Limiting** | [SlowAPI](https://github.com/laurentS/slowapi) | Limits listing generation to 5 requests/minute per IP by default |
| **CI / Hosting** | GitHub Actions, Render, Vercel | Lint, test, and build on every push; API on Render, frontend on Vercel |

> There is no user login yet. All saved products are visible to every visitor.

---

## 📁 Repository Structure

```text
online-seller-assistant/
├── .env.example                  # Template for all environment variables (values empty)
├── .github/workflows/ci.yml      # CI: Ruff + Pytest (backend), ESLint + Vite build (frontend)
├── render.yaml                   # Render web service definition for the backend
├── docs/                         # Architecture, pipeline, runbook, onboarding, team guides
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI app: CORS, error handling, all REST endpoints
│   │   ├── config.py             # Settings (OpenAI model, CORS origins, rate limit)
│   │   ├── database.py           # Engine/session setup, table creation, SELECT 1 health check
│   │   ├── models.py             # SQLAlchemy models: Product, ProductAnalysis, ProductListing
│   │   ├── schemas.py            # Pydantic request/response schemas
│   │   ├── limiter.py            # SlowAPI rate limiter
│   │   └── agents/
│   │       ├── product_analyzer.py   # Agent 1: structured product profile
│   │       ├── market_analyzer.py    # Agent 2: price tier, buyer concerns, platform strategy
│   │       ├── listing_generator.py  # Agent 3: Shopee / TikTok Shop / Lazada listings
│   │       ├── validation.py         # Schema, claims, and grounding gates with one retry
│   │       └── logger.py             # Structured execution logs stored per product
│   ├── tests/                    # Pytest suite (in-memory SQLite, OpenAI stubbed)
│   ├── pyproject.toml            # Ruff and pytest configuration
│   └── requirements.txt          # Python dependencies
└── frontend/
    ├── src/
    │   ├── App.jsx               # App state, API calls, form, product profile, catalog, DevOps tab
    │   ├── components/
    │   │   ├── AgentLogsConsole.jsx    # Collapsible agent activity log
    │   │   ├── MarketStrategyCard.jsx  # Agent 2 output
    │   │   └── ListingPreview.jsx      # Agent 3 output with copy and edit
    │   ├── main.jsx              # React DOM entrypoint
    │   └── index.css             # Tailwind directives
    ├── package.json              # Node dependencies & scripts
    ├── vite.config.js            # Vite configuration (dev server on port 5173)
    ├── tailwind.config.js        # Tailwind configuration
    └── eslint.config.js          # ESLint flat config with React rules
```

---

## ⚙️ Environment Variables

A `.env.example` file is included in the project root. Create your local `.env` by copying it:

```bash
cp .env.example .env
```

On Windows PowerShell, run this from the repository root:

```powershell
Copy-Item .env.example .env
```

If your terminal is already in `backend/`, use:

```powershell
Copy-Item ..\.env.example ..\.env
```

Then edit the `.env` in the repository root and set `DATABASE_URL` to the connection
string for a running PostgreSQL database. The backend loads this project-root `.env`
automatically when started from `backend/`.

> **Security Note:** Never commit your actual `.env` file or place real secrets into version control. Real keys should only exist in your local `.env` or in deployment secret managers.

### Variables

- `OPENAI_API_KEY`: API key for the AI agents. If empty, every agent uses its rule-based fallback, so the app still works offline.
- `DATABASE_URL`: Connection string for PostgreSQL (e.g., `postgresql://postgres:password@localhost:5432/seller_db`).
- `CORS_ORIGINS`: Comma-separated list of allowed frontend origins (defaults to the local Vite ports). Any `https://*.vercel.app` origin is also allowed.
- `VITE_API_URL`: Backend base URL used by the frontend (defaults to `http://localhost:8000`).
- `JWT_SECRET`: Reserved for planned user authentication. Not used by the current code.

Optional backend settings (not in `.env.example`):

- `OPENAI_MODEL`: OpenAI model name (default `gpt-4o-mini`).
- `RATE_LIMIT_GENERATE_LISTING`: Rate limit for listing generation and the full pipeline (default `5/minute`).

---

## 🚀 Local Setup Steps

### Prerequisites
- **Node.js** (v18.x or higher) & **npm**
- **Python** (v3.10 or higher)
- **PostgreSQL** instance (local server or Docker container)

---

### 1. Database Setup (PostgreSQL)

Ensure PostgreSQL is running and create a database for the project:

```bash
# Example via psql:
createdb seller_db

# Or with Docker:
docker run --name seller-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=seller_db -p 5432:5432 -d postgres:16
```

Set your `DATABASE_URL` in `.env`:
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/seller_db
```

If `/health` returns `503` with `DATABASE_URL environment variable is not configured`,
check that `.env` exists in the repository root and contains a non-empty `DATABASE_URL`.
If it instead reports a connection error, verify PostgreSQL is running and that the
database name, username, password, host, and port in the URL are correct.

---

### 2. Backend Setup (FastAPI)

1. Open a terminal and navigate to `backend/`:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   ```bash
   # Windows (PowerShell):
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS / Linux:
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run code formatting and linting with Ruff:
   ```bash
   ruff check .
   ruff format . --check
   ```

5. Run test suite:
   ```bash
   pytest
   ```

6. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   - API Docs will be available at [http://localhost:8000/docs](http://localhost:8000/docs)
   - Health check endpoint will be available at [http://localhost:8000/health](http://localhost:8000/health)

---

### 3. Frontend Setup (React + Vite + Tailwind)

1. Open a new terminal and navigate to `frontend/`:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run linting:
   ```bash
   npm run lint
   ```

4. Start the frontend development server:
   ```bash
   npm run dev
   ```
   - Access the UI at [http://localhost:5173](http://localhost:5173)

---

### 4. Verify It Works

When both servers are running:
1. Open `http://localhost:5173`.
2. Click an example product (e.g. **Bamboo Keyboard**), then **⚡ Create My Listings**.
3. The product profile, selling strategy, and Shopee / TikTok Shop / Lazada listings appear on the right, and the product is added to **Your Saved Products**.
4. The **System Status** tab calls `GET /health`. If PostgreSQL is reachable, the backend runs `SELECT 1` and returns `200 OK` with database status `connected`.

---

## 👥 Team Roles & Responsibilities

The DevOps Engineer owns CI/CD and deployment. All other members are Developers.

| Role | Team Member | Primary Responsibilities |
|------|-------------|--------------------------|
| **DevOps Engineer** | Benaiah Asis | CI/CD pipelines, containerization, environment configuration, repo standards, deployment |
| **Frontend Lead** | Joan Ballarta | React UI architecture, Tailwind styling, state management, API integration |
| **Backend Lead** | Al Rodge Rendal | FastAPI API design, PostgreSQL data modeling, SQLAlchemy ORM, authentication |
| **AI / Integrations Engineer** | Ken Matthew Navarro | OpenAI API orchestration, prompt engineering, smart assistant features |
| **QA & Testing Engineer** | Ruelyn Jose | Automated test coverage (pytest, frontend tests), edge case validation |
| **Product / Scrum Lead** | Benaiah Asis | Requirements tracking, user stories, milestone alignment, group coordination |

---

## 📚 Project Documentation

- [📋 Sprint Deliverables & Action Items](docs/SPRINT_DELIVERABLES.md): Full sprint breakdown (Sprints 1-4) with step-by-step assignments for each team member.
- [🚀 Team Onboarding & Git Guide](docs/TEAM_ONBOARDING.md): Local environment setup, Git workflow, and branch rules.
- [🔄 CI/CD Pipeline Guide](docs/PIPELINE.md): GitHub Actions automation, pip/npm caching, and Render/Vercel deployment.
- [🏗️ System Architecture](docs/SYSTEM_ARCHITECTURE.md): How the three agents, validation layer, API, and database fit together.
- [📖 DevOps Runbook](docs/runbook.md): Disaster recovery, troubleshooting, and deployment runbook.
