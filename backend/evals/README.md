# AI Evaluation Set

This is a small, fixed set of products used to tell whether a prompt or agent change made the three-agent pipeline better or worse.

## What it checks
`eval_set.json` has **10 cases**, chosen to stress the guardrails:
- **Clean inputs:** candle, keyboard, cushion, earbuds.
- **A seller-supported claim:** a tumbler described as "food-grade" and "BPA-free", so those claims *are* allowed.
- **Unverified hype:** "Most bought item" and "Free strap".
- **A thin input:** a shirt with just "oversized fit".
- **A product that tempts health claims:** a face serum.
- **Missing materials:** a mouse pad.
- **A very high price:** a ₱100,000 scooter.

`run_eval.py` runs each case through the deployed backend's full pipeline. It scores the stored result with checks that don't depend on exact wording, because the model isn't deterministic:

| Check | Passes when |
|---|---|
| `three_listings` | Exactly one listing each for Shopee, TikTok Shop and Lazada |
| `no_new_claims` | The final listings contain no claim the seller didn't support (same claim rules as the backend) |
| `clean_hashtags` | No hashtag is a bare raw material or filler word (`#zinc`, `#free`) |
| `grounded_title` | Every title reuses a word from the product name |

It also records each agent's validation path: **accepted first try**, **recovered after a retry**, or **fell back** to the rule-based output. Test products are deleted after each case.

## Running it
```bash
cd backend
python -m evals.run_eval                                   # against production
python -m evals.run_eval --base-url http://localhost:8000 --pause 4
```
Reports are written to `results/` as Markdown and JSON. In CI, `.github/workflows/ai-eval.yml` runs the set on every PR that touches `backend/app/agents/**` (against that PR's own backend) and once a day.

## Results

### Run 1: 2026-11-25 20:03 UTC, production, before fixes → [results/20261125-2003.md](results/20261125-2003.md)
**8/10 passed all checks.**

| Check | Passed |
|---|---|
| three_listings | 10/10 |
| no_new_claims | 10/10 |
| clean_hashtags | 10/10 |
| grounded_title | **8/10** |

| Agent | First try | Recovered | Fell back |
|---|---|---|---|
| Agent 1 | 8 | 1 | 1 |
| Agent 2 | 7 | 2 | 1 |
| Agent 3 | 5 | 4 | 1 |

**What the run found, and what we changed:**
1. **TikTok titles sometimes left out the product name** (cushion, serum), e.g. "Unwind with cozy relaxation…".
   - **Fix:** Agent 3's grounding checks now reject any title that doesn't name the product, so the model retries. The prompt also says TikTok hooks must still name the product.
   - **Regression test:** `test_listing_agent_retries_when_a_title_drops_the_product_name`.
2. **The no-materials case fell back in all three agents.** The grounding tokenizer only counted words of 4+ letters, so facts like "900 x 400 mm" could never be grounded, and every AI answer was wrongly rejected.
   - **Fix:** `validation.words()` now also counts numbers of 2+ digits.
   - **Regression test:** `test_numeric_facts_can_be_grounded`.

### Run 2: after fixes
*To be added after the v1.0.0 release is deployed.*

## Known limitations
- 10 cases is a small sample. Treat the results as a regression signal, not a benchmark.
- `no_new_claims` reuses the backend's own regex rules, so it can't catch a claim those rules don't know about. A reworded claim would slip through both.
- Runs use the free Gemini tier, so a run can hit the daily quota. That shows up as fallbacks, not failures.
