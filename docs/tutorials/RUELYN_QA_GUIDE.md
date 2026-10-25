# 🧪 Sprint 3 Tutorial & Assignment: QA & Testing Engineer
**Assigned to:** Ruelyn Jose  
**Role:** QA & Testing Engineer  
**Branch to Create:** `feature/ruelyn-qa-pipeline-tests`  
**Primary Files to Work On:**
- `backend/tests/test_agents.py` (Unit & Integration tests)
- `docs/metrics-log.md` (Test execution metrics & log)

---

## 🎯 Your Mission in Sprint 3
In Sprint 2, our team had 11 automated test cases.  
In **Sprint 3**, your mission as QA Engineer is to verify our new **Multi-Agent Pipeline** against edge cases and real-world scenarios:
1. Write automated test cases for edge cases:
   - Unicode emojis and special characters in product names (e.g., `"🔥 Smart Tumbler 500ml ❄️"`).
   - Very long seller notes or supplier specs (> 500 characters).
   - Empty or null materials and features (ensuring the agents don't crash).
2. Validate that Agent 3 always outputs all 3 platforms (`shopee`, `tiktok`, `lazada`) with non-empty titles, descriptions, and hashtags.
3. Log our test suite metrics and pass rates in **`docs/metrics-log.md`**.

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
git checkout -b feature/ruelyn-qa-pipeline-tests
```

---

## 💻 Step 2: Set Up & Run Pytest

In the terminal:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Run the test suite:
python -m pytest -v
```

👉 You will see the initial 16 passing tests!

---

## ✍️ Step 3: Your Tasks & Test Code to Add

Open `backend/tests/test_agents.py` in VS Code.

Scroll to the bottom of the file and add these edge-case test functions:

### Test Case 1: Test Emojis & Special Characters
```python
def test_pipeline_with_unicode_emojis():
    """Verify the pipeline gracefully handles unicode emojis and symbols."""
    res = client.post(
        "/api/products",
        json={
            "name": "🔥 LED Gaming Headset 🎧 (7.1 Surround & RGB)",
            "price": 59.99,
            "quantity": 30,
            "materials": "Memory foam cushions, aluminum frame ⚡",
            "features": "Noise cancelling mic, ultra-light 250g ✨",
        },
    )
    assert res.status_code == 201
    product_id = res.json()["id"]

    # Run full 3-agent pipeline
    pipe_res = client.post(f"/api/products/{product_id}/full-pipeline")
    assert pipe_res.status_code == 200
    assert pipe_res.json()["status"] == "completed"
```

---

### Test Case 2: Test Empty / Null Optional Fields
```python
def test_pipeline_with_minimal_fields():
    """Verify agents run cleanly when optional materials & features are empty."""
    res = client.post(
        "/api/products",
        json={
            "name": "Simple Desk Organizer",
            "price": 12.00,
            "quantity": 10,
            "materials": None,
            "features": None,
        },
    )
    assert res.status_code == 201
    product_id = res.json()["id"]

    pipe_res = client.post(f"/api/products/{product_id}/full-pipeline")
    assert pipe_res.status_code == 200
    product = pipe_res.json()["product"]
    assert product["analysis"] is not None
    assert product["analysis"]["category"] is not None
```

---

### Task B: Document the Test Results in `docs/metrics-log.md`
Open `docs/metrics-log.md` and add an entry:
```markdown
## Sprint 3 QA Test Execution Log
- **Date:** October 2026
- **Total Test Cases:** 18
- **Pass Rate:** 100% (18/18 passed)
- **Execution Time:** ~3.5 seconds
- **Edge Cases Tested:** Emojis/unicode characters, empty features/materials, platform hashtag validations.
```

---

## 🧪 Step 4: Test Your Work Locally

Run the linter and tests:

```powershell
# 1. Run Ruff linter:
ruff check .

# 2. Run Pytest suite:
python -m pytest -v
```

👉 All 18 tests should pass in under 4 seconds!

---

## 🚀 Step 5: Save, Commit, and Push Your Work

```bash
# 1. Check changed files
git status

# 2. Stage changes
git add backend/tests/ docs/metrics-log.md

# 3. Commit with a message
git commit -m "test(qa): add edge case tests for unicode emojis and empty fields"

# 4. Push to GitHub
git push -u origin feature/ruelyn-qa-pipeline-tests
```

---

## 📬 Step 6: Open Your Pull Request (PR)

1. Go to: **[github.com/BenaiahAsis/online-seller-assistant](https://github.com/BenaiahAsis/online-seller-assistant)**
2. Click **"Compare & pull request"**.
3. Set:
   * **base:** `feature/sprint-3-pipeline`
   * **compare:** `feature/ruelyn-qa-pipeline-tests`
4. Title: `test(qa): Sprint 3 multi-agent edge case test suite`
5. Click **"Create pull request"**.
6. Notify **Benaiah Asis** on group chat!
