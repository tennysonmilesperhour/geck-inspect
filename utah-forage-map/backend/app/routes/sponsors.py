from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Sponsor
from app.schemas import SponsorRead

router = APIRouter(prefix="/sponsors", tags=["sponsors"])


@router.get("/active", response_model=list[SponsorRead])
def get_active_sponsors(db: Session = Depends(get_db)):
    """
    Returns all currently active sponsor placements.
    Used by the frontend to hydrate AdSlot components with direct sponsors
    instead of (or in addition to) AdSense.
    """
    today = date.today()
    return (
        db.query(Sponsor)
        .filter(
            Sponsor.is_active == True,
            or_(Sponsor.starts_on.is_(None), Sponsor.starts_on <= today),
            or_(Sponsor.ends_on.is_(None), Sponsor.ends_on >= today),
        )
        .order_by(Sponsor.created_at)
        .all()
    )
