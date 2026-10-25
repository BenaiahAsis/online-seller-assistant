# 🎨 Sprint 3 Tutorial & Assignment: Frontend Lead
**Assigned to:** Joan Ballarta  
**Role:** Frontend Lead  
**Branch to Create:** `feature/joan-frontend-listings`  
**Primary Files to Work On:**
- `frontend/src/App.jsx`
- (Optional new component: `frontend/src/components/ListingPreview.jsx`)

---

## 🎯 Your Mission in Sprint 3
In Sprint 2, we built the **Product Analyzer** input form and the structured output card for Agent 1.  
In **Sprint 3**, your mission is to build the **Multi-Platform Listing Preview** interface:
1. Allow sellers to view listings generated for **Shopee**, **TikTok Shop**, and **Lazada**.
2. Add platform switcher tabs: `[Shopee / Lazada]` `[TikTok Shop]` `[Instagram]`.
3. Build a **"Copy to Clipboard"** button so sellers can copy the title and description with 1 click.
4. Add a primary button: **"⚡ Generate Full Pipeline (All 3 Agents)"** that calls `POST /api/products/{id}/full-pipeline`.

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
git checkout -b feature/joan-frontend-listings
```

---

## 💻 Step 2: Set Up & Start the Frontend

In the terminal:

```powershell
cd frontend
npm install
npm run dev
```

👉 Your local app will open at: **`http://localhost:5173`**!

---

## ✍️ Step 3: Your Tasks & Code to Add

Open `frontend/src/App.jsx` in VS Code.

### Task A: Add State for Listings & Selected Platform
At the top of `App()`:
```javascript
const [selectedPlatform, setSelectedPlatform] = useState('shopee'); // 'shopee' | 'tiktok' | 'lazada'
const [copied, setCopied] = useState(false);
```

---

### Task B: Add the "Run Full Pipeline" Handler
In `App.jsx`, add a function that calls the backend's new full pipeline endpoint:
```javascript
const handleRunFullPipeline = async (productId) => {
  try {
    const res = await fetch(`${productsEndpoint}/${productId}/full-pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    setSelectedProduct(data.product);
    setNotification({
      type: 'success',
      message: 'Full 3-agent pipeline completed successfully!',
    });
    fetchProducts();
  } catch (err) {
    setNotification({ type: 'error', message: 'Failed to run full pipeline' });
  }
};
```

---

### Task C: Build the Listing Preview UI Card
In the JSX under the structured analysis card, add a platform switcher and listing preview:

```jsx
{/* Platform Selector */}
<div className="flex items-center gap-2 border-b border-slate-800 pb-3">
  {['shopee', 'tiktok', 'lazada'].map((platform) => (
    <button
      key={platform}
      onClick={() => setSelectedPlatform(platform)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
        selectedPlatform === platform
          ? 'bg-indigo-600 text-white shadow-md'
          : 'bg-slate-900 text-slate-400 hover:text-white'
      }`}
    >
      {platform}
    </button>
  ))}
</div>

{/* Copy to Clipboard Button */}
<button
  onClick={() => {
    navigator.clipboard.writeText(currentListingText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }}
  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
>
  {copied ? '✓ Copied to Clipboard!' : '📋 Copy Listing'}
</button>
```

---

## 🧪 Step 4: Test Your Work Locally

Before pushing, make sure the linter and production build pass with 0 errors!

In your `frontend/` terminal:
```powershell
# 1. Run ESLint (must have 0 errors):
npm run lint

# 2. Test production build:
npm run build
```

👉 You should see **built in X.XXs** with zero errors!

---

## 🚀 Step 5: Save, Commit, and Push Your Work

```bash
# 1. Check changed files
git status

# 2. Stage changes
git add frontend/src/

# 3. Commit with a message
git commit -m "feat(ui): add multi-platform listing preview and copy to clipboard"

# 4. Push to GitHub
git push -u origin feature/joan-frontend-listings
```

---

## 📬 Step 6: Open Your Pull Request (PR)

1. Go to: **[github.com/BenaiahAsis/online-seller-assistant](https://github.com/BenaiahAsis/online-seller-assistant)**
2. Click **"Compare & pull request"**.
3. Set:
   * **base:** `feature/sprint-3-pipeline`
   * **compare:** `feature/joan-frontend-listings`
4. Title: `feat(ui): Sprint 3 multi-platform listing previews and copy features`
5. Click **"Create pull request"**.
6. Tell **Benaiah Asis** on group chat!
