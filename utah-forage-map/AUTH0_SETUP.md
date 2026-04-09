# Auth0 Setup Guide

Utah Forage Map uses Auth0 for social authentication (Google, Apple, Facebook).
This guide walks through the one-time setup.

---

## 1. Create an Auth0 Application

1. Log in to [manage.auth0.com](https://manage.auth0.com) and open your tenant.
2. Go to **Applications → Create Application**.
3. Name it `Utah Forage Map` and choose **Single Page Application**.
4. Under **Settings**, set:
   - **Allowed Callback URLs**: `http://localhost:5173, https://your-vercel-domain.vercel.app`
   - **Allowed Logout URLs**: same as above
   - **Allowed Web Origins**: same as above
5. Copy the **Domain** and **Client ID** — you'll need these for the frontend.

---

## 2. Create an Auth0 API (for the backend audience)

1. Go to **Applications → APIs → Create API**.
2. Name it `Utah Forage Map API`.
3. Set **Identifier** (audience) to `https://api.utah-forage-map.com` (or your own URL — just be consistent).
4. Leave signing algorithm as **RS256**.

---

## 3. Enable Social Connections

1. Go to **Authentication → Social**.
2. Enable **Google** (requires a Google Cloud OAuth client ID/secret).
3. Optionally enable **Apple** and **Facebook**.
4. Make sure each connection is enabled for your SPA application.

---

## 4. Configure Environment Variables

### Backend (`backend/.env`)

```
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_AUDIENCE=https://api.utah-forage-map.com
```

### Frontend (`frontend/.env`)

```
VITE_AUTH0_DOMAIN=your-tenant.us.auth0.com
VITE_AUTH0_CLIENT_ID=your-spa-client-id
VITE_AUTH0_AUDIENCE=https://api.utah-forage-map.com
```

---

## 5. Run the Migration

The Auth0 fields are added in migration `a9f3c2e8b1d4`:

```bash
cd backend
alembic upgrade head
```

This makes `hashed_password` nullable and adds `auth0_id`, `avatar_url`, `display_name` to the users table.

---

## 6. GitHub Actions Secrets

Add these to **Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `AUTH0_DOMAIN` | `your-tenant.us.auth0.com` |
| `AUTH0_AUDIENCE` | `https://api.utah-forage-map.com` |
| `VITE_AUTH0_DOMAIN` | same as AUTH0_DOMAIN |
| `VITE_AUTH0_CLIENT_ID` | your SPA client ID |
| `VITE_AUTH0_AUDIENCE` | same as AUTH0_AUDIENCE |

---

## How it works

1. User clicks **Sign in** → `loginWithPopup()` opens Auth0 Universal Login.
2. User authenticates via Google / Apple / Facebook.
3. Auth0 returns an access token (RS256 JWT, audience = your API identifier).
4. Frontend POSTs the token to `POST /api/v1/users/sync`.
5. Backend verifies the token against Auth0's JWKS endpoint and upserts the user row.
6. Subsequent API calls include `Authorization: Bearer <token>` for protected routes.
