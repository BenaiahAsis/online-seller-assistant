# ⚙️ Sprint 3 Tutorial & Assignment: Backend Lead
**Assigned to:** Al Rodge Rendal  
**Role:** Backend Lead  
**Branch to Create:** `feature/al-backend-listings`  
**Primary Files to Work On:**
- `backend/app/models.py` (Database schema)
- `backend/app/schemas.py` (Pydantic validation)
- `backend/app/main.py` (FastAPI REST endpoints)

---

## 🎯 Your Mission in Sprint 3
In Sprint 2, we built the `Product` and `ProductAnalysis` models with basic CRUD endpoints.  
In **Sprint 3**, your mission is to connect our new **Multi-Agent Pipeline** to the database and API:
1. Ensure the **`ProductListing`** database model stores platform listings (`shopee`, `tiktok`, `lazada`).
2. Review and verify the new REST endpoints in `main.py`:
   - `POST /api/products/{id}/market-analysis` (Triggers Agent 2)
   - `POST /api/products/{id}/generate-listings` (Triggers Agent 3)
   - `POST /api/products/{id}/full-pipeline` (Chains Agent 1 &rarr; Agent 2 &rarr; Agent 3 sequentially!)
   - `GET /api/products/{id}/listings` (Fetches saved listings)
3. Test all endpoints interactively using **FastAPI Swagger Docs (`/docs`)**.

---

## 🛠️ Step 1: Clone the Repo & Create Your Branch

Open your terminal (PowerShell, Command Prompt, or Mac Terminal) and run:

```bash
# 1. Go to your projects folder
cd Desktop

# 2. Clone the repository (if you haven't already)
git clone https://github.com/BenaiahAsis/online-seller-assistant.git
cd online-seller-assistant

# 3. Pull the latest code and base your branch off feature/sprint-3-pipeline
git checkout feature/sprint-3-pipeline
git pull origin feature/sprint-3-pipeline

# 4. Create your own personal working branch:
git checkout -b feature/al-backend-listings
```

---

## 💻 Step 2: Set Up & Start the Backend

In the terminal, run:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Start the development server:
python -m uvicorn app.main:app --reload
```
*(On Mac/Linux: use `source venv/bin/activate` instead of `.\venv\Scripts\activate`)*.

👉 Your server is running at: **`http://localhost:8000`**!  
Open **`http://localhost:8000/docs`** in your browser to see the interactive Swagger UI!

---

## ✍️ Step 3: Your Tasks & Code to Inspect

### Task A: Inspect the `ProductListing` Model (`backend/app/models.py`)
Open `backend/app/models.py`. Check lines 65-88:
```python
class ProductListing(Base):
    __tablename__ = "product_listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    bullet_points: Mapped[list | None] = mapped_column(JSON, default=list, nullable=True)
    hashtags: Mapped[list | None] = mapped_column(JSON, default=list, nullable=True)
    call_to_action: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
```
*Notice how each product can have multiple listings across Shopee, TikTok, and Lazada!*

---

### Task B: Test the Endpoints via Swagger (`http://localhost:8000/docs`)
1. In your browser at `http://localhost:8000/docs`:
2. Find `POST /api/products` &rarr; click **"Try it out"** &rarr; execute a sample product (e.g. `$25.00` Thermal Tumbler).
3. Note the returned `id` (e.g., `1`).
4. Find `POST /api/products/{product_id}/full-pipeline`:
   - Enter `product_id: 1` &rarr; click **Execute**.
   - Notice how it automatically runs Agent 1 &rarr; Agent 2 &rarr; Agent 3 and returns the complete structured profile and 3 listings in one request!
5. Find `GET /api/products/{product_id}/listings`:
   - Enter `product_id: 1` &rarr; verify that the 3 saved listings are returned.

---

## 🧪 Step 4: Test Your Work Locally

In a new terminal window in the `backend/` folder:

```powershell
# 1. Run the Ruff linter (must have 0 errors):
ruff check .

# 2. Run the automated Pytest suite:
python -m pytest -v
```

👉 You should see **16 passed** in green!

---

## 🚀 Step 5: Save, Commit, and Push Your Work

```bash
# 1. Check which files you changed
git status

# 2. Stage your changes
git add backend/app/

# 3. Commit with a clear message
git commit -m "feat(backend): verify ProductListing model and multi-agent pipeline routes"

# 4. Push your branch to GitHub
git push -u origin feature/al-backend-listings
```

---

## 📬 Step 6: Open Your Pull Request (PR)

1. Go to: **[github.com/BenaiahAsis/online-seller-assistant](https://github.com/BenaiahAsis/online-seller-assistant)**
2. Click **"Compare & pull request"**.
3. Set:
   * **base:** `feature/sprint-3-pipeline`
   * **compare:** `feature/al-backend-listings`
4. Title: `feat(backend): ProductListing models and full-pipeline orchestration`
5. Click **"Create pull request"**.
6. Notify **Benaiah Asis** on group chat!
