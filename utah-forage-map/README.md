# Utah Forage Map

Utah Forage Map — a collaborative, GPS-based mushroom foraging map for Utah with community sightings, seasonal filters, elevation zones, and web-crawled data from iNaturalist, GBIF, and other sources.

## Project Structure

```
utah-forage-map/
├── frontend/        # React + Vite + Tailwind CSS + Mapbox GL JS
├── backend/         # Python FastAPI + SQLAlchemy + PostgreSQL
│   ├── app/         # FastAPI application
│   ├── crawler/     # Web scraper scripts (iNaturalist, GBIF, etc.)
│   └── scripts/     # One-off utility scripts (seeding, migrations)
└── .github/
    └── workflows/   # GitHub Actions CI/CD
```

## Tech Stack

### Frontend
- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)
- [TanStack Query](https://tanstack.com/query) for data fetching
- [Axios](https://axios-http.com/) for HTTP requests
- [date-fns](https://date-fns.org/) for date formatting

### Backend
- [FastAPI](https://fastapi.tiangolo.com/)
- [SQLAlchemy](https://www.sqlalchemy.org/) ORM
- [Alembic](https://alembic.sqlalchemy.org/) for migrations
- [PostgreSQL](https://www.postgresql.org/)
- [crawl4ai](https://github.com/unclecode/crawl4ai) for web crawling

## Data Sources
- [iNaturalist API](https://api.inaturalist.org/v1/docs/)
- [GBIF API](https://www.gbif.org/developer/summary)

## Getting Started

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env values
uvicorn app.main:app --reload
```
