# Pipeline Metrics Log

**Source:** GitHub Actions run history (workflow `CI`) and the GitHub Deployments that Render and Vercel report back to the repository. The numbers were pulled from the GitHub API on 2026-11-26, and nothing is estimated.

- **Pipeline time:** wall-clock time from run start to finish, with the `backend` and `frontend` jobs running in parallel.
- **Prod deploys:** Render backend deploys of `main` plus Vercel Production deploys. Vercel PR previews are listed separately.
- **Weeks:** ISO weeks. There was no repository activity in weeks 45 and 49.

| Week (dates) | Avg PR pipeline | Main pipeline | Success rate | Prod deploys (Render + Vercel) | PR previews | Lead time, merge → live | Failed deploys | Time to recover | Change made this week |
|---|---|---|---|---|---|---|---|---|---|
| W41 (Oct 11) | 0.43 min (26 s), n=1 | — | 0% (0/1) | 0 | 0 | not captured | 0 | 8.3 h (lint fix merged next day) | Baseline CI added (PR #3): Ruff + Pytest, ESLint + Vite build, two parallel jobs, pip/npm caching |
| W42 (Oct 12–17) | 0.35 min (21 s), n=6 | 0.33 min (20 s), n=5 | 100% (11/11) | 11 (7 + 4) | 4 | not captured | 0 | — | Render deploy config + env-based CORS (PR #4); pipeline docs, runbook, log templates (PR #5) |
| W43 (Oct 18–24) | 0.38 min (23 s), n=3 | 0.37 min (22 s), n=2 | 100% (5/5) | 5 (3 + 2) | 4 | not captured | 0 | — | Sprint 2–3 features; API tests with mocked LLM added to the suite |
| W44 (Oct 25–26) | 0.38 min (23 s), n=1 | 0.35 min (21 s), n=3 | 100% (4/4) | 5 (2 + 3) | 1 | not captured | 0 | — | Agents 2–3 validation gates with scripted fake clients in tests (PR #10) |
| W46 (Nov 14–15) | 0.33 min (20 s), n=2 | 0.35 min (21 s), n=5 | 100% (7/7) | 9 (4 + 5) | 4 | not captured | 0 | — | Validation events recorded in logs (PR #12); UI redesign (PR #13) |
| W47 (Nov 20) | 0.40 min (24 s), n=1 | 0.35 min (21 s), n=1 | 100% (2/2) | 2 (1 + 1) | 1 | not captured | 0 | — | Demo PR #14 opened (UX, docs) |
| W48 (Nov 23–25) | 0.35 min (21 s), n=2 | 0.37 min (22 s), n=2 | 100% (4/4) | 8 (6 + 2) | 2 | not captured | 0 | — | PR #14 and #15 merged; production AI configured (see incident log) |
| W48 (Nov 26) | *to be filled after the v1.0.0 merge* | | | | | *measured live on the release merge* | | | Added secret scanning (gitleaks), Ruff format check, cancel-outdated-runs, post-deploy smoke tests, scheduled AI evaluation |

**Totals (Oct 11 – Nov 25):**
- **CI runs:** 34 total, 33 successful (97%). The only failure was the first run of PR #3 (Ruff lint errors). It was fixed before merge, so it never reached `main`.
- **Production deploys:** 40 total, 23 Render and 17 Vercel, with no failed production deploys recorded.
- **Merged PRs:** 15.

**Not yet measured:** merge-to-live lead time. GitHub records when each deploy started, but the success timestamps were not collected. Lead time will be measured during the v1.0.0 release merge and the live deploy challenge.
