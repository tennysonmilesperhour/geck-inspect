import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str | None] = mapped_column(String, nullable=True)
    auth0_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True, index=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    role: Mapped[str] = mapped_column(String, default="user")
    trust_level: Mapped[int] = mapped_column(Integer, default=0)
    total_finds: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sightings: Mapped[list["Sighting"]] = relationship("Sighting", back_populates="user", foreign_keys="Sighting.user_id")
    verifications: Mapped[list["Verification"]] = relationship("Verification", back_populates="verifier")


class Species(Base):
    __tablename__ = "species"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    common_name: Mapped[str] = mapped_column(String, nullable=False)
    latin_name: Mapped[str] = mapped_column(String, nullable=False)
    edibility: Mapped[str | None] = mapped_column(String)
    look_alikes: Mapped[str | None] = mapped_column(Text)
    habitat_notes: Mapped[str | None] = mapped_column(Text)
    peak_months: Mapped[str | None] = mapped_column(String)  # comma-separated ints, e.g. "5,6,7,8"
    elevation_min_ft: Mapped[int | None] = mapped_column(Integer)
    elevation_max_ft: Mapped[int | None] = mapped_column(Integer)
    utah_regions: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)

    sightings: Mapped[list["Sighting"]] = relationship("Sighting", back_populates="species")


class Sighting(Base):
    __tablename__ = "sightings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    species_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("species.id"), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    elevation_ft: Mapped[float | None] = mapped_column(Float)
    found_on: Mapped[date | None] = mapped_column(Date)
    month: Mapped[int | None] = mapped_column(Integer)
    habitat_type: Mapped[str | None] = mapped_column(String)
    substrate: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)
    photo_url: Mapped[str | None] = mapped_column(String)
    source: Mapped[str] = mapped_column(String, default="community")
    confidence_score: Mapped[int] = mapped_column(Integer, default=50)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="sightings", foreign_keys=[user_id])
    species: Mapped["Species"] = relationship("Species", back_populates="sightings")
    verifications: Mapped[list["Verification"]] = relationship("Verification", back_populates="sighting")
    crawled_sources: Mapped[list["CrawledSource"]] = relationship("CrawledSource", back_populates="sighting")


class Verification(Base):
    __tablename__ = "verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sighting_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sightings.id"), nullable=False)
    verifier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    confirmed: Mapped[bool | None] = mapped_column(Boolean)
    notes: Mapped[str | None] = mapped_column(Text)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sighting: Mapped["Sighting"] = relationship("Sighting", back_populates="verifications")
    verifier: Mapped["User"] = relationship("User", back_populates="verifications")


class Sponsor(Base):
    __tablename__ = "sponsors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    tagline: Mapped[str | None] = mapped_column(String)
    image_url: Mapped[str | None] = mapped_column(String)
    link_url: Mapped[str] = mapped_column(String, nullable=False)
    placement: Mapped[str] = mapped_column(String, nullable=False)  # matches AD_SLOTS key
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CrawledSource(Base):
    __tablename__ = "crawled_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sighting_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sightings.id"), nullable=True)
    source_name: Mapped[str] = mapped_column(String, nullable=False)
    source_url: Mapped[str] = mapped_column(String, nullable=False)
    raw_data: Mapped[str | None] = mapped_column(Text)
    crawled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sighting: Mapped["Sighting | None"] = relationship("Sighting", back_populates="crawled_sources")
