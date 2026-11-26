# Scope Change Log

These are the changes from the approved pitch (`Online Seller Assistant: A Sequential Multi-Agent AI E-Commerce Assistant`). None of them drops one of the seven required acceptance criteria.

| # | Pitch said | What we built | Why | Effect on requirements |
|---|---|---|---|---|
| 1 | A `users` table, seller login, and JWT auth (`JWT_SECRET`). | **No accounts.** All products are shared. `JWT_SECRET` is reserved but unused. | Time went into the AI validation and the pipeline, which are the core of the product. Login isn't one of the seven required criteria. | None. CRUD still uses 3 related tables (`products` 1–1 `product_analyses`, `products` 1–N `product_listings`). Listed as future work. |
| 2 | One final listing per product. | **Three listings per product**, one each for Shopee, TikTok Shop and Lazada. | Each marketplace rewards a different style: search keywords, a short hook, or spec detail. Target users sell on all three. | Strengthens the AI feature. |
| 3 | Agent 2 finds target customers, selling points and keywords. | **Agent 1** finds audience and keywords. **Agent 2** does price tier, ranked selling points, buyer objections, and a per-platform strategy. | Avoids two agents doing the same work. Each agent has one clear responsibility that can be validated. | No change to the required criteria. |
| 4 | Listing fields: category, tags, short promotional description, status. | Listing fields: title, description, bullet points, hashtags, call to action, platform. | These match what marketplaces actually ask for. The category is stored on the analysis instead. | None. |
| 5 | AI provider: OpenAI API. | **OpenAI-compatible SDK**, with the provider set through `OPENAI_BASE_URL`. Production uses Google Gemini (`gemini-3.5-flash-lite`). | Free tier for a student project. The configuration also allowed provider switches during incidents 3–4. | None. The backend still owns all AI calls. |
| 6 | "Backend validates each agent's output" (all three agents). | Agents 2 and 3 had validation gates from Sprint 3. **Agent 1 was added to the same gates in v1.0.0** (PR #15). | Closes the gap with the pitch. | Meets the pitch. |
