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
2. **Continuous Deployment [untested]**:
   - Pushes to the `main` branch trigger automatic build and deployment on Render.
   - Health check monitors `/health`.

### Frontend (Vercel)
1. **Initial Setup [untested]**:
   - In the Vercel Dashboard, import the Git repository.
   - Set **Root Directory** to `frontend`.
   - Vercel automatically detects Vite framework preset (build command `npm run build`, output directory `dist`).
   - Add environment variable:
     - `VITE_API_URL` (URL of the deployed Render backend, e.g., `https://<service-name>.onrender.com`).
2. **Continuous Deployment [untested]**:
   - Pushes to `main` automatically trigger production deployments on Vercel.

---

## 2. Rollback

### Frontend Rollback (Vercel) [untested]
If a frontend release introduces visual regressions or runtime errors:
1. Open the **Vercel Dashboard** and navigate to the project.
2. Go to the **Deployments** tab.
3. Locate the previous known-good deployment.
4. Click the three-dots menu (`...`) next to the deployment and select **Instant Rollback** / **Promote to Production**.
5. Traffic immediately routes to the previous deployment artifact.

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

### JWT Secret (`JWT_SECRET`) [untested]
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
4. **Pre-warm Frontend**: Open the Vercel frontend URL in an incognito window and confirm the status indicators turn green.
