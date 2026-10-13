# 🚀 Team Onboarding & Git Quick-Start Guide

> **Project:** Online Seller Assistant  
> **Team:**  
> - **DevOps & Scrum Lead:** Benaiah Asis  
> - **Frontend Lead:** Joan Ballarta  
> - **Backend Lead:** Al Rodge Rendal  
> - **AI / Integrations Engineer:** Ken Matthew Navarro  
> - **QA & Testing Engineer:** Ruelyn Jose  

Welcome to the team! This guide walks you through setting up your local developer environment, learning the only 5 Git commands you need, and collaborating using our automated CI/CD pipeline.

---

## 🛠️ 1. Prerequisites (Install Once)

Before touching the codebase, ensure you have these installed:

1. **Git:** Download and install from [git-scm.com](https://git-scm.com/).
   * After installing, open a terminal (PowerShell on Windows, Terminal on macOS) and introduce yourself to Git:
     ```bash
     git config --global user.name "Your Full Name"
     git config --global user.email "your-github-email@example.com"
     ```
2. **Node.js (v20+ LTS):** Download from [nodejs.org](https://nodejs.org/).
3. **Python (v3.11 or v3.12):** Download from [python.org](https://www.python.org/).
   * ⚠️ *Windows Users: Make sure to check the box "Add Python to PATH" on the first installer screen.*
4. **VS Code:** Recommended editor. Recommended extensions:
   * **Python** (by Microsoft)
   * **ESLint** (by Microsoft)
   * **Tailwind CSS IntelliSense** (by Tailwind Labs)

---

## 📥 2. Clone the Repository

Open your terminal in the directory where you keep your coding projects (e.g. `Desktop` or `Projects`), and clone the repo:

```bash
git clone https://github.com/BenaiahAsis/online-seller-assistant.git
cd online-seller-assistant
```

---

## 💻 3. Running the App Locally

The project is structured as a monorepo with `frontend/` and `backend/`.

### A. Frontend (React + Vite + Tailwind)
Open a terminal in the project root:
```bash
cd frontend
npm install
npm run dev
```
* **Local Web App:** Opens at [http://localhost:5173](http://localhost:5173).

### B. Backend (FastAPI + SQLAlchemy + PostgreSQL)
Open a **second terminal** in the project root:
```bash
cd backend

# 1. Create a Python virtual environment (only do this the first time)
python -m venv venv

# 2. Activate the virtual environment:
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS / Linux:
source venv/bin/activate

# 3. Install required packages:
pip install -r requirements.txt

# 4. Start the FastAPI development server:
uvicorn app.main:app --reload
```
* **API Server:** Running at [http://localhost:8000](http://localhost:8000)
* **Interactive API Documentation:** Available at [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛡️ 4. The 5-Step Git Workflow (Never Break Main!)

> ⚠️ **RULE #1:** **NEVER edit code directly on the `main` branch.**  
> Always create a feature branch for your work!

Whenever you start a new task:

### Step 1: Update your local `main` branch
```bash
git checkout main
git pull origin main
```

### Step 2: Create your own feature branch
Create and switch to a descriptive branch name:
* **Joan (Frontend):** `git checkout -b feature/seller-product-form`
* **Al Rodge (Backend):** `git checkout -b feature/product-database-models`
* **Ken (AI):** `git checkout -b feature/product-analysis-agent`
* **Ruelyn (QA):** `git checkout -b test/agent-output-validation`

### Step 3: Check what you modified
As you write code, check what files have changed:
```bash
git status
```

### Step 4: Run local tests & linters
Before committing, verify that your changes pass our quality checks:
* In `backend/`: run `ruff check .` and `pytest`
* In `frontend/`: run `npm run lint` and `npm run build`

### Step 5: Save (Commit) and Push
```bash
git add .
git commit -m "feat: describe your change in one clear sentence"
git push -u origin your-branch-name
```

---

## 🚀 5. Opening a Pull Request (PR)

1. Go to our repository: [github.com/BenaiahAsis/online-seller-assistant](https://github.com/BenaiahAsis/online-seller-assistant).
2. Click the green/yellow **"Compare & pull request"** banner that appears for your branch.
3. Fill out the PR template checklist (what changed, how you tested it, no secrets committed).
4. Click **Create pull request**.
5. **Watch the CI status checks:**
   * GitHub Actions will automatically run our parallel `backend` and `frontend` test suites.
   * If you get a green checkmark (**✅**), tag a teammate or DevOps lead to review and merge into `main`!
   * If you get a red X (**❌**), click *Details*, fix the issue locally, commit, and push again.

---

## 🤖 6. Using AI Coding CLIs (Claude Code, etc.) Safely

In this AI Engineering course, using AI CLIs is encouraged! Follow these guardrails:

1. **Be on your feature branch:** Run `git branch` before invoking any AI tool.
2. **Review AI changes:** Run `git diff` to inspect every file modified by the AI.
3. **Verify with Linters:** Run `ruff check .` (Python) and `npm run lint` (JS) to ensure the AI did not leave syntax errors or unused variables.
4. **Never let an AI commit directly to `main` or add API keys to version control.**

---

## 📋 Sprint 2 Responsibilities Breakdown

| Member | Role | Sprint 2 Focus | Working Directories |
|---|---|---|---|
| **Benaiah Asis** | DevOps & Scrum Lead | CI caching, database migrations support, Render & Vercel deployment sync | `.github/`, root configs, `docs/` |
| **Joan Ballarta** | Frontend Lead | Product Details input form (name, price, features, materials, qty) & results display | `frontend/src/` |
| **Al Rodge Rendal** | Backend Lead | Database schemas & endpoints for saving raw products and agent outputs | `backend/app/` |
| **Ken Matthew Navarro** | AI / Integrations Lead | OpenAI client setup & **Agent 1: Product Analysis Agent** prompt orchestration | `backend/app/agents/` |
| **Ruelyn Jose** | QA & Testing Lead | Automated pytest suites for agent input validation and mocked API tests | `backend/tests/` |
