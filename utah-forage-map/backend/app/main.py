from fastapi import FastAPI

app = FastAPI(
    title="Utah Forage Map API",
    description="Backend API for the Utah Forage Map — a collaborative GPS-based mushroom foraging map.",
    version="0.1.0",
)


@app.get("/health")
async def health():
    return {"status": "ok", "project": "utah-forage-map"}
