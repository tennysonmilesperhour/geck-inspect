from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Sighting, Species

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/by-month")
def stats_by_month(db: Session = Depends(get_db)):
    rows = (
        db.query(Sighting.month, func.count(Sighting.id).label("count"))
        .filter(Sighting.month.isnot(None))
        .group_by(Sighting.month)
        .order_by(Sighting.month)
        .all()
    )
    return [{"month": r.month, "count": r.count} for r in rows]


@router.get("/by-species")
def stats_by_species(db: Session = Depends(get_db)):
    rows = (
        db.query(Species.common_name, func.count(Sighting.id).label("count"))
        .join(Sighting, Sighting.species_id == Species.id)
        .group_by(Species.id, Species.common_name)
        .order_by(func.count(Sighting.id).desc())
        .all()
    )
    return [{"species": r.common_name, "count": r.count} for r in rows]


@router.get("/by-elevation")
def stats_by_elevation(db: Session = Depends(get_db)):
    band_size = 1000
    band_expr = func.floor(Sighting.elevation_ft / band_size) * band_size
    rows = (
        db.query(band_expr.label("band_ft"), func.count(Sighting.id).label("count"))
        .filter(Sighting.elevation_ft.isnot(None))
        .group_by(band_expr)
        .order_by(band_expr)
        .all()
    )
    return [
        {
            "elevation_band": f"{int(r.band_ft)}-{int(r.band_ft) + 999} ft",
            "count": r.count,
        }
        for r in rows
    ]
