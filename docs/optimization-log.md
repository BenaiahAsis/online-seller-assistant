# Pipeline Optimization Log

All timings come from GitHub Actions run history: wall-clock time per workflow run. See [metrics-log.md](metrics-log.md).

| # | Change | Before | After | How measured | What we learned |
|---|---|---|---|---|---|
| 1 | **Parallel jobs.** `backend` and `frontend` run as two independent jobs (since the first pipeline, PR #3). | Not measured: there was never a sequential version. | 20–26 s per run, across all 34 runs. | Run duration from the Actions API. | Parallel jobs mean total time equals the slower job, not the two added together. With jobs this short, more splitting wouldn't help. |
| 2 | **Dependency caching.** `actions/setup-python` caches pip and `actions/setup-node` caches npm, keyed on `requirements.txt` and `package-lock.json` (since PR #3). | Not measured: caching was on from the first run. | Same 20–26 s range. | Run duration from the Actions API. | We can't claim a speed-up without a "before" number. A cache-busted run is planned, to put a real number on it. |
| 3 | **Mocked LLM in tests.** Scripted fake clients replace real AI calls, and `conftest.py` removes any real key (PRs #10, #15). | Not applicable: tests never called a live model. | 0 AI calls and $0 per CI run. CI doesn't depend on the AI provider being up. | Test code review; `conftest.py` strips `OPENAI_API_KEY`. | Mocking keeps CI fast, free, and deterministic. A live smoke test runs separately on a schedule. |
| 4 | **Cancel outdated runs.** `concurrency` with `cancel-in-progress` for PR branches (this release). | A push to an open PR left the previous run going. | The older run is cancelled. `main` runs are never cancelled. | Will appear as `cancelled` runs in the Actions history from the next PR on. | This saves runner minutes when several fixes are pushed quickly, for example during the live deploy challenge. |
| 5 | **Fail-fast quality gates.** Ruff format check after lint, plus a separate `secret-scan` job (gitleaks) running in parallel (this release). | Lint + test + build only. | Adds about 10–20 s to the slowest job, to be confirmed on the first run. | First run of the release PR. | This adds checks rather than speed: secrets and formatting are now enforced automatically instead of by review. |

**Planned measurement:** run CI once with the caches cleared (Actions → Caches → delete) and compare to a cached run. That gives a real before-and-after number for item 2.
