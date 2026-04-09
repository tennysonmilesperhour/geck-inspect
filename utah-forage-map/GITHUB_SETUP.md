# GitHub Secrets Setup

Add these secrets in your GitHub repo under **Settings → Secrets and variables → Actions → New repository secret**.

---

## Frontend Deploy (`deploy-frontend.yml`)

| Secret | Where to get it |
|---|---|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) — create a token scoped to your account |
| `VERCEL_ORG_ID` | Run `vercel whoami` in the `frontend/` dir after `npx vercel link`; also shown in `.vercel/project.json` as `orgId` |
| `VERCEL_PROJECT_ID` | Run `npx vercel link` in `frontend/`; shown in `.vercel/project.json` as `projectId` |
| `VITE_MAPBOX_TOKEN` | [account.mapbox.com/access-tokens](https://account.mapbox.com/access-tokens) — create a public token restricted to your domain |
| `VITE_API_URL` | Your Railway backend URL, e.g. `https://utah-forage-map.up.railway.app` |

**First-time Vercel setup:**
```bash
cd frontend
npx vercel login
npx vercel link        # creates .vercel/project.json with org + project IDs
npx vercel env add VITE_MAPBOX_TOKEN
npx vercel env add VITE_API_URL
```

---

## Backend Deploy (`deploy-backend.yml`)

| Secret | Where to get it |
|---|---|
| `RAILWAY_TOKEN` | [railway.app/account/tokens](https://railway.app/account/tokens) — create a project-scoped token |

**First-time Railway setup:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and link the backend service
railway login
cd backend
railway link          # select your project + service
railway up            # first deploy (subsequent ones happen via CI)
```

Set these environment variables in the Railway dashboard (Settings → Variables) for your backend service:

```
DATABASE_URL=postgresql://...   # from your Railway Postgres plugin
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
MAPBOX_TOKEN=pk.eyJ1...
INATURALIST_API_KEY=<optional>
ENVIRONMENT=production
```

---

## Crawler (`run-crawler.yml`)

| Secret | Where to get it |
|---|---|
| `DATABASE_URL` | Railway → your Postgres plugin → Connect tab → copy the `DATABASE_URL` |
| `SECRET_KEY` | Same value used in the backend Railway service |

The crawler job runs **every Sunday at 06:00 UTC** and can also be triggered manually from the **Actions** tab → **Run Crawlers** → **Run workflow**.

---

## Full secrets checklist

```
VERCEL_TOKEN          ← Vercel account token
VERCEL_ORG_ID         ← from .vercel/project.json after vercel link
VERCEL_PROJECT_ID     ← from .vercel/project.json after vercel link
VITE_MAPBOX_TOKEN     ← Mapbox public access token
VITE_API_URL          ← e.g. https://utah-forage-map.up.railway.app
RAILWAY_TOKEN         ← Railway project-scoped token
DATABASE_URL          ← PostgreSQL connection string (from Railway Postgres)
SECRET_KEY            ← 64-char hex secret for JWT signing
```

> **Note:** These workflow files assume `frontend/`, `backend/`, and `.github/` are at
> the **root of your GitHub repository**. If you're working inside a monorepo wrapper
> (e.g. `geck-inspect/utah-forage-map/`), either move the contents to a dedicated repo
> or adjust the `paths:` and `working-directory:` values in each workflow file.
