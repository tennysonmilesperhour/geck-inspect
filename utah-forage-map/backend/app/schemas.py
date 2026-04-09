import uuid
from datetime import date, datetime

from pydantic import BaseModel, EmailStr


# ── Species ───────────────────────────────────────────────────────────────────

class SpeciesRead(BaseModel):
    id: uuid.UUID
    common_name: str
    latin_name: str
    edibility: str | None
    look_alikes: str | None
    habitat_notes: str | None
    peak_months: str | None
    elevation_min_ft: int | None
    elevation_max_ft: int | None
    utah_regions: str | None
    notes: str | None

    model_config = {"from_attributes": True}


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserRead(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    role: str
    trust_level: int
    total_finds: int
    is_active: bool
    joined_at: datetime

    model_config = {"from_attributes": True}


# ── Sighting ──────────────────────────────────────────────────────────────────

class SightingCreate(BaseModel):
    species_id: uuid.UUID
    latitude: float
    longitude: float
    elevation_ft: float | None = None
    found_on: date | None = None
    month: int | None = None
    habitat_type: str | None = None
    substrate: str | None = None
    notes: str | None = None
    photo_url: str | None = None
    source: str = "community"
    confidence_score: int = 50


class SightingRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    species_id: uuid.UUID
    latitude: float
    longitude: float
    elevation_ft: float | None
    found_on: date | None
    month: int | None
    habitat_type: str | None
    substrate: str | None
    notes: str | None
    photo_url: str | None
    source: str
    confidence_score: int
    verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class SightingFilter(BaseModel):
    species_id: uuid.UUID | None = None
    month_min: int | None = None
    month_max: int | None = None
    elev_min: float | None = None
    elev_max: float | None = None
    habitat_type: str | None = None
    source: str | None = None
    verified_only: bool | None = None


# ── Verification ──────────────────────────────────────────────────────────────

class VerificationCreate(BaseModel):
    sighting_id: uuid.UUID
    confirmed: bool
    notes: str | None = None


# Used by POST /sightings/{id}/verify — sighting_id comes from the path
class VerificationVote(BaseModel):
    confirmed: bool
    notes: str | None = None
