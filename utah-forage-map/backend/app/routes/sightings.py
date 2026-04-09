import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Sighting, User, Verification
from app.schemas import SightingCreate, SightingRead, VerificationVote

router = APIRouter(prefix="/sightings", tags=["sightings"])


@router.get("", response_model=list[SightingRead])
def list_sightings(
    # Taxonomic / attribute filters
    species_id: Optional[uuid.UUID] = None,
    month: Optional[int] = None,
    elev_min: Optional[float] = None,
    elev_max: Optional[float] = None,
    habitat_type: Optional[str] = None,
    source: Optional[str] = None,
    verified_only: bool = False,
    # Map-bounds bbox
    lat_min: Optional[float] = None,
    lat_max: Optional[float] = None,
    lon_min: Optional[float] = None,
    lon_max: Optional[float] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Sighting)

    if species_id is not None:
        q = q.filter(Sighting.species_id == species_id)
    if month is not None:
        q = q.filter(Sighting.month == month)
    if elev_min is not None:
        q = q.filter(Sighting.elevation_ft >= elev_min)
    if elev_max is not None:
        q = q.filter(Sighting.elevation_ft <= elev_max)
    if habitat_type is not None:
        q = q.filter(Sighting.habitat_type == habitat_type)
    if source is not None:
        q = q.filter(Sighting.source == source)
    if verified_only:
        q = q.filter(Sighting.verified.is_(True))

    # Bounding-box filter for map viewport
    if lat_min is not None:
        q = q.filter(Sighting.latitude >= lat_min)
    if lat_max is not None:
        q = q.filter(Sighting.latitude <= lat_max)
    if lon_min is not None:
        q = q.filter(Sighting.longitude >= lon_min)
    if lon_max is not None:
        q = q.filter(Sighting.longitude <= lon_max)

    return q.order_by(Sighting.created_at.desc()).all()


@router.post("", response_model=SightingRead, status_code=status.HTTP_201_CREATED)
def create_sighting(
    payload: SightingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sighting = Sighting(**payload.model_dump(), user_id=current_user.id)
    db.add(sighting)
    current_user.total_finds += 1
    db.commit()
    db.refresh(sighting)
    return sighting


@router.get("/{sighting_id}", response_model=SightingRead)
def get_sighting(sighting_id: uuid.UUID, db: Session = Depends(get_db)):
    sighting = db.query(Sighting).filter(Sighting.id == sighting_id).first()
    if not sighting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sighting not found")
    return sighting


@router.post("/{sighting_id}/verify", status_code=status.HTTP_201_CREATED)
def verify_sighting(
    sighting_id: uuid.UUID,
    payload: VerificationVote,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sighting = db.query(Sighting).filter(Sighting.id == sighting_id).first()
    if not sighting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sighting not found")
    if sighting.user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot verify your own sighting",
        )

    verification = Verification(
        sighting_id=sighting_id,
        verifier_id=current_user.id,
        confirmed=payload.confirmed,
        notes=payload.notes,
    )
    db.add(verification)

    # Auto-mark verified once 3 independent users confirm
    confirmed_count = (
        db.query(Verification)
        .filter(Sighting.id == sighting_id, Verification.confirmed.is_(True))
        .count()
    ) + (1 if payload.confirmed else 0)

    if confirmed_count >= 3:
        sighting.verified = True

    db.commit()
    db.refresh(verification)
    return {"id": str(verification.id), "confirmed": verification.confirmed}
