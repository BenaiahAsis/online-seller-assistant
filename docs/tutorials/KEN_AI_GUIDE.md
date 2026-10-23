# 🤖 Sprint 3 Tutorial & Assignment: AI & Integrations Engineer
**Assigned to:** Ken Matthew Navarro  
**Role:** AI & Integrations Engineer  
**Branch to Create:** `feature/ken-agents-2-and-3`  
**Primary Files to Work On:**
- `backend/app/agents/market_analyzer.py` (Agent 2)
- `backend/app/agents/listing_generator.py` (Agent 3)

---

## 🎯 Your Mission in Sprint 3
In Sprint 2, our team built **Agent 1 (Product Analyzer)**, which extracts structured product specs (category, target audience, keywords).  
Your mission in **Sprint 3** is to build the AI intelligence for:
1. **Agent 2: Market Analysis Agent** (`market_analyzer.py`) &rarr; Identifies buyer psychological triggers and competitive market positioning.
2. **Agent 3: Listing Generation Agent** (`listing_generator.py`) &rarr; Writes ready-to-use e-commerce listings tailored for **Shopee**, **TikTok Shop**, and **Lazada**!

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
git checkout -b feature/ken-agents-2-and-3
```

---

## 💻 Step 2: Set Up Your Backend Environment

In the same terminal, navigate into the backend:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```
*(On Mac/Linux: use `source venv/bin/activate` instead of `.\venv\Scripts\activate`)*.

---

## ✍️ Step 3: Your Tasks & Code to Edit

### Task A: Refine Agent 2 Prompts (`backend/app/agents/market_analyzer.py`)
Open `backend/app/agents/market_analyzer.py` in VS Code.

Look at the function `run_market_analyzer_agent()`. Notice the OpenAI prompt around line 90:
```python
prompt = (
    "You are an e-commerce market analyst (Agent 2).\n"
    "Analyze the product and profile to extract buyer triggers, "
    "competitive edge, and platform strategies (Shopee, TikTok, Lazada).\n\n"
    f"Product: {name}\n"
    f"Price: ${price:.2f}\n"
    ...
)
```

**What you can improve/add:**
1. Improve the prompt instructions to instruct the AI to identify **pain points** that the product solves.
2. Ensure the fallback function `_derive_fallback_market_insights()` produces realistic market insights even when testing offline without an OpenAI key.

---

### Task B: Refine Agent 3 Listing Formats (`backend/app/agents/listing_generator.py`)
Open `backend/app/agents/listing_generator.py` in VS Code.

Look at `_derive_fallback_listings()` and `run_listing_generator_agent()`.
Notice how it outputs 3 distinct listings:
1. **Shopee Listing:** High-converting title (< 120 chars), structured bullet points, warranty/shipping info.
2. **TikTok Shop Listing:** Viral hook ("POV: ..."), aesthetic styling, trending hashtags (`#tiktokmademebuyit`, `#techtok`).
3. **Lazada Listing:** Professional store format, specifications table, voucher call-to-action.

**What you can improve/add:**
- Enhance the copy formatting (e.g. adding bullet emojis `✅`, `🔥`, `📦`).
- Ensure hashtag generation strips spaces properly (e.g. `"#WirelessKeyboard"` instead of `"#Wireless Keyboard"`).

---

## 🧪 Step 4: Test Your Work Locally

Before pushing to GitHub, make sure your code passes all automated tests and linter rules:

In your `backend` terminal, run:
```powershell
# 1. Run the linter (must have 0 errors):
ruff check .

# 2. Run the test suite:
python -m pytest -v
```

👉 You should see **16 passed** in green!

---

## 🚀 Step 5: Save, Commit, and Push Your Work

When your tests pass, save your changes and push them to GitHub:

```bash
# 1. Check which files you changed
git status

# 2. Stage your changes
git add backend/app/agents/

# 3. Commit with a clear message
git commit -m "feat(ai): refine Agent 2 market triggers and Agent 3 copy templates"

# 4. Push your branch to GitHub
git push -u origin feature/ken-agents-2-and-3
```

---

## 📬 Step 6: Open Your Pull Request (PR)

1. Go to: **[github.com/BenaiahAsis/online-seller-assistant](https://github.com/BenaiahAsis/online-seller-assistant)**
2. Click the yellow banner: **"Compare & pull request"**  
   *(Or click "Pull requests" > "New pull request")*
3. Set:
   * **base:** `feature/sprint-3-pipeline`
   * **compare:** `feature/ken-agents-2-and-3`
4. Title: `feat(ai): Agent 2 & Agent 3 prompt and copy refinements`
5. Click **"Create pull request"**.
6. Message **Benaiah Asis** on group chat: *"PR is ready for review!"*
