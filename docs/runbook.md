# Operational Runbook

This runbook outlines operational procedures for deploying, maintaining, and recovering the **Online Seller Assistant** services across Render (backend), Vercel (frontend), and Neon (PostgreSQL).

> **Note:** Procedures not yet validated in live production staging are marked as **[untested]**.

---

## 1. Deploy

### Backend (Render Web Service)
1. **Initial Setup [untested]**:
   - In the Render Dashboard, create a new Web Service using Blueprint or select the repository.
   - Render detects `render.yaml` with root directory `backend`, Python runtime, build command `pip install -r requirements.txt`, and start command `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
   - Configure required environment variables in the Render Dashboard:
     - `OPENAI_API_KEY`
     - `DATABASE_URL`
     - `JWT_SECRET`
     - `CORS_ORIGINS` (Vercel production URL, e.g., `https://<project-name>.vercel.app`)
     - Optional: `OPENAI_MODEL`, `OPENAI_BASE_URL` (for an OpenAI-compatible provider such as GitHub Models), and `ALLOW_AI_FAILURE_SIMULATION=true` (enables the `X-Simulate-AI-Failure` demo header)
   - If `OPENAI_API_KEY` is missing, the app still works, but every listing comes from the rule-based fallback. The UI then shows "Template version (AI unavailable)".
2. **Continuous Deployment** (verified when PR #14 was merged):
   - Pushes to the `main` branch trigger automatic build and deployment on Render.
   - Health check monitors `/health`.

### Frontend (Vercel)
1. **Initial Setup [untested]**:
   - In the Vercel Dashboard, import the Git repository.
   - Set **Root Directory** to `frontend`.
   - Vercel automatically detects Vite framework preset (build command `npm run build`, output directory `dist`).
   - Add environment variable:
     - `VITE_API_URL` (URL of the deployed Render backend, e.g., `https://<service-name>.onrender.com`).
2. **Continuous Deployment** (verified when PR #14 was merged):
   - Pushes to `main` automatically trigger production deployments on Vercel.
   - Every pull request gets a Vercel preview deployment, linked on the PR.

---

## 2. Rollback

### Frontend Rollback (Vercel) [tested 2026-11-27, about 18 s to recover]
If a frontend release introduces visual regressions or runtime errors:
1. Open the **Vercel Dashboard** and navigate to the project.
2. Go to the **Deployments** tab and click the previous known-good **Production** deployment to open its page. (The list row's actions button is hidden on narrow screens; the deployment page always has it.)
3. Click the **⋯** menu at the top right and choose **Instant Rollback**. On the free Hobby plan only the *previous* production deployment is offered; an earlier one needs Pro.
4. Type a short reason (it is kept in the project history) and click **Continue**, then **Confirm Rollback**. Vercel reassigns the production domain to that deployment within seconds.
5. Hard-refresh the live site (Ctrl+Shift+R) and confirm the old version is back.
6. **Roll forward when the fix is ready.** After a rollback Vercel stops promoting new production deploys automatically. Open the latest good deployment, click **⋯ → Promote**, and confirm ("This action will undo the current Instant Rollback"). Until you do this, merges to `main` will build but not go live.

### Backend Rollback (Render) [untested]
If a backend release fails or introduces API regressions:
1. Open the **Render Dashboard** and navigate to the Web Service.
2. Select the **Events** / **Deploys** tab.
3. Locate the previous successful deploy.
4. Click the action menu and select **Rollback to this deploy**.
5. Render deploys the previous container image or rebuilds the corresponding commit.

---

## 3. Rotating Secrets

### OpenAI API Key (`OPENAI_API_KEY`) [untested]
1. Navigate to the **OpenAI Platform Dashboard** -> **API Keys**.
2. Create a new secret key and copy its value.
3. Open the **Render Dashboard** -> Web Service -> **Environment**.
4. Update `OPENAI_API_KEY` with the new key and click **Save Changes**.
5. Wait for the service to restart, then verify `/health` and test assistant requests.
6. Delete/revoke the old key in the OpenAI platform.

### JWT Secret (`JWT_SECRET`) [reserved, not in use]
`JWT_SECRET` is declared for planned user authentication, but the current backend does not read it.
Rotating it has no effect today. If authentication is added later:
1. Generate a new secure random string (e.g., using `openssl rand -hex 32`).
2. Open the **Render Dashboard** -> Web Service -> **Environment**.
3. Update `JWT_SECRET` and click **Save Changes**.
4. Render restarts the backend service.
   * *Note: Active user tokens will be invalidated; users will need to re-authenticate.*

### Database Password on Neon (`DATABASE_URL`) [untested]
1. Open the **Neon Console** -> Select Project -> **Roles & Databases**.
2. Locate the database user role and select **Reset Password**.
3. Copy the updated connection string (`postgresql://<user>:<new-password>@<neon-host>/<db>?sslmode=require`).
4. Open the **Render Dashboard** -> Web Service -> **Environment**.
5. Update `DATABASE_URL` with the new connection string and click **Save Changes**.
6. Verify database connectivity by checking the `/health` endpoint response (`database: "connected"`).

---

## 4. Cold-Start Check Before Demos [untested]

The Render free tier puts web services to sleep after 15 minutes of inactivity:
1. **Pre-warm Instance**: 5 to 10 minutes before any live presentation or grading demo, open a browser or terminal and ping the health endpoint:
   ```bash
   curl -I https://<render-backend-url>/health
   ```
2. **Wait for Spin-Up**: The initial spin-up can take 30 to 60 seconds while Render provisions the container and connects to the Neon PostgreSQL database.
3. **Verify Health**: Confirm the endpoint responds with `HTTP 200 OK` and payload:
   ```json
   {
     "status": "healthy",
     "database": "connected"
   }
   ```
4. **Pre-warm Frontend**: Open the Vercel frontend URL in an incognito window and confirm the **System Status** indicator turns green.
5. **Confirm the AI is live**: Regenerate listings for one product. If the amber "Template version (AI unavailable)" badge appears, check `OPENAI_API_KEY` on Render before presenting.

---

## 5. Cutting a Release

1. Merge the release PR into `main` after review. Render and Vercel deploy it automatically.
2. Wait until both deploys are live and the **Post-deploy smoke test** workflow is green (GitHub → Actions).
3. Tag the exact commit that is live in production, then push the tag:
   ```bash
   git checkout main && git pull
   git tag -a v1.0.0 -m "v1.0.0"
   git push origin v1.0.0
   ```
4. On GitHub, go to **Releases → Draft a new release**, choose the tag, and paste that version's section from `CHANGELOG.md`.
5. **Rollback target:** the previous tag, or the previous deploy in the Render and Vercel dashboards (see section 2).

## 6. Rehearsing a Rollback (do this once before Demo Day)

1. **Render:** service → **Events** → find the deploy *before* the current one → **Rollback**. Wait for it to go live, then check that `/health` returns 200. Then roll forward again by redeploying the latest commit.
2. **Vercel (done 2026-11-27):** project → **Deployments** → previous Production deployment → **⋯ → Instant Rollback**. Open the site to confirm it changed, then open the latest deployment → **⋯ → Promote** to roll forward. Measured: rollback confirmed 20:10:30, old version live by 20:10:48; promoted 20:11:48, new version live by 20:12:02. Details in `docs/metrics-log.md`.
3. Record the time each step took in `docs/metrics-log.md` (time to recover). **Still to do:** rehearse the Render rollback (step 1) and record its time.
