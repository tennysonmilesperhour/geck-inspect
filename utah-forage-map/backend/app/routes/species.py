import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Species
from app.schemas import SpeciesRead

router = APIRouter(prefix="/species", tags=["species"])


@router.get("", response_model=list[SpeciesRead])
def list_species(search: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Species)
    if search:
        term = f"%{search}%"
        q = q.filter(
            Species.common_name.ilike(term) | Species.latin_name.ilike(term)
        )
    return q.order_by(Species.common_name).all()


@router.get("/{species_id}", response_model=SpeciesRead)
def get_species(species_id: uuid.UUID, db: Session = Depends(get_db)):
    species = db.query(Species).filter(Species.id == species_id).first()
    if not species:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Species not found")
    return species
