# Online Seller Assistant

A full-stack web application that helps small and new online sellers create better
product listings with less effort. Sellers enter basic product details such as name,
price, features, materials, and quantity. The app then runs them through a sequential
three-agent AI workflow:

1. **Product Analysis Agent** organizes the raw details into a structured product profile.
2. **Market Analysis Agent** identifies target customers, selling points, and keywords.
3. **Listing Generation Agent** writes a complete, ready-to-use product listing.

The backend validates each agent's output before passing it to the next one and stores
the products, analyses, and listings in a PostgreSQL database. Sellers can review and
edit the final listing before saving it.

---

## 🛠 Tech Stack

| Layer | Technology | Description |
|---|---|---|
| **Frontend** | [React](https://react.dev/) + [Vite](https://vitejs.dev/) | Fast, component-driven client interface |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | Modern utility-first responsive styling |
| **Frontend Tooling** | [ESLint](https://eslint.org/) | Code quality and React standards enforcement |
| **Backend** | [FastAPI](https://fastapi.tiangolo.com/) | High-performance asynchronous Python API framework |
| **ORM / Database** | [SQLAlchemy 2.0](https://www.sqlalchemy.org/) + [PostgreSQL](https://www.postgresql.org/) | Relational database modeling, migrations, and queries |
| **Backend Tooling** | [Ruff](https://docs.astral.sh/ruff/) + [Pytest](https://docs.pytest.org/) | Lightning-fast Python linting/formatting and test automation |
| **AI Integration** | [OpenAI API](https://platform.openai.com/) | Intelligent customer interaction and product descriptions |
| **Authentication** | JWT (JSON Web Tokens) | Stateless, secure user session management |

---

## 📁 Repository Structure

```text
online-seller-assistant/
├── .env.example             # Template for all environment variables (keys empty)
├── .gitignore                # Ignores .env, node_modules, __pycache__, venv
├── README.md                 # Project documentation and developer guide
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── database.py       # SQLAlchemy connection & SELECT 1 health check
│   │   └── main.py           # FastAPI entrypoint with CORS & GET /health
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_health.py    # Pytest suite for API and database health
│   ├── pyproject.toml        # Ruff linter/formatter & pytest configuration
│   └── requirements.txt      # Python dependencies
└── frontend/
    ├── src/
    │   ├── App.jsx           # Main monitor UI querying GET /health
    │   ├── main.jsx          # React DOM entrypoint
    │   └── index.css         # Tailwind directives
    ├── index.html            # Vite HTML template
    ├── package.json          # Node dependencies & scripts
    ├── vite.config.js        # Vite build configuration
    ├── tailwind.config.js    # Tailwind content & theme configuration
    ├── postcss.config.js     # PostCSS pipeline for Tailwind & Autoprefixer
    └── eslint.config.js      # ESLint flat config with React rules
```

---

## ⚙️ Environment Variables

A `.env.example` file is included in the project root. Create your local `.env` by copying it:

```bash
cp .env.example .env
```

> **Security Note:** Never commit your actual `.env` file or place real secrets into version control. Real keys should only exist in your local `.env` or in deployment secret managers.

### Variables

- `OPENAI_API_KEY`: API key for OpenAI assistant features.
- `DATABASE_URL`: Connection string for PostgreSQL (e.g., `postgresql://postgres:password@localhost:5432/seller_db`).
- `JWT_SECRET`: Secret key used for signing and verifying JSON Web Tokens.
- `VITE_API_URL`: Backend base URL used by the frontend (defaults to `http://localhost:8000`).

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

### 4. Health Verification

When both servers are running:
1. Navigate to `http://localhost:5173` in your browser.
2. The UI fetches `GET /health` from `http://localhost:8000/health`.
3. If PostgreSQL is reachable, the backend executes `SELECT 1` and returns `200 OK` with database status `connected`.
4. The dashboard displays green health badges and the raw JSON payload.

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
