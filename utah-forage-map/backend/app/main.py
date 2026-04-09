from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import sightings, species, sponsors, stats, users

app = FastAPI(
    title="Utah Forage Map API",
    description="Backend API for the Utah Forage Map — a collaborative GPS-based mushroom foraging map.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"

app.include_router(sightings.router, prefix=API_PREFIX)
app.include_router(species.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(stats.router, prefix=API_PREFIX)
app.include_router(sponsors.router, prefix=API_PREFIX)


@app.get("/health")
async def health():
    return {"status": "ok", "project": "utah-forage-map"}
