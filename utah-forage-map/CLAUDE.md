# Utah Forage Map — Claude Code Context

## Project
Utah Forage Map — a collaborative GPS-based mushroom foraging map for Utah.
Users log sightings, verify finds, and explore what grows where and when.
A web crawler bootstraps data from iNaturalist, GBIF, and Mushroom Observer.

## Stack
Frontend: React 18, Vite, Tailwind CSS, Mapbox GL JS, TanStack Query, axios
Backend: Python 3.11, FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL, psycopg2
Crawler: Python, httpx, crawl4ai, schedule
Hosting: Frontend → Vercel, Backend → Railway, DB → Railway PostgreSQL
Repo: monorepo — /frontend, /backend (includes /crawler and /scripts)

## Key conventions
- All API routes prefixed with /api/v1/
- UUIDs for all primary keys
- .env files never committed — use .env.example as template
- Pydantic v2 for all request/response validation
- Sighting.source values: "community", "inaturalist", "gbif",
  "mushroom_observer", "web_crawl"
- Elevation always in feet
- Coordinates always as float latitude, float longitude (WGS84)
- Species colors for map pins: chanterelle=#EF9F27, morel=#639922,
  porcini=#D85A30, oyster=#378ADD, lion's mane=#7F77DD, default=#888780

## Utah elevation zones (reference)
- Desert/plateau:      2500–4500 ft  (St. George, Moab, San Rafael)
- Foothill/transition: 4500–6500 ft  (canyon mouths, Gambel oak)
- Montane:             6500–9500 ft  (Wasatch, Manti-La Sal, mixed conifer)
- High alpine:         9500–13500 ft (Uintas, La Sals, subalpine)

## Database
Five tables: User, Species, Sighting, Verification, CrawledSource
See backend/app/models.py for full schema.
Run migrations with: cd backend && alembic upgrade head
Seed species with:   python scripts/seed_species.py

## Auth
Auth0 RS256 JWT — no local passwords for regular users.
Backend verifies tokens against Auth0 JWKS (`https://{AUTH0_DOMAIN}/.well-known/jwks.json`).
POST /api/v1/users/sync upserts user on first login; GET /api/v1/users/me requires Bearer token.
Crawler still uses a fixed system user UUID (no Auth0 sub).

Backend env: AUTH0_DOMAIN, AUTH0_AUDIENCE
Frontend env: VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, VITE_AUTH0_AUDIENCE

See AUTH0_SETUP.md for full setup instructions.

## Running locally
Backend:  cd backend && uvicorn app.main:app --reload --port 8000
Frontend: cd frontend && npm run dev   (runs on port 5173)
Crawler:  cd backend && python crawler/inaturalist.py
