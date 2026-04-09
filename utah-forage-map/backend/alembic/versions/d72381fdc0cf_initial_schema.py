"""initial schema

Revision ID: d72381fdc0cf
Revises:
Create Date: 2026-04-09 06:11:11.288832

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "d72381fdc0cf"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(), nullable=False, unique=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="user"),
        sa.Column("trust_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_finds", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "joined_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "species",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("common_name", sa.String(), nullable=False),
        sa.Column("latin_name", sa.String(), nullable=False),
        sa.Column("edibility", sa.String(), nullable=True),
        sa.Column("look_alikes", sa.Text(), nullable=True),
        sa.Column("habitat_notes", sa.Text(), nullable=True),
        sa.Column("peak_months", sa.String(), nullable=True),
        sa.Column("elevation_min_ft", sa.Integer(), nullable=True),
        sa.Column("elevation_max_ft", sa.Integer(), nullable=True),
        sa.Column("utah_regions", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "sightings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("species_id", UUID(as_uuid=True), sa.ForeignKey("species.id"), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("elevation_ft", sa.Float(), nullable=True),
        sa.Column("found_on", sa.Date(), nullable=True),
        sa.Column("month", sa.Integer(), nullable=True),
        sa.Column("habitat_type", sa.String(), nullable=True),
        sa.Column("substrate", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=False, server_default="community"),
        sa.Column("confidence_score", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "verifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("sighting_id", UUID(as_uuid=True), sa.ForeignKey("sightings.id"), nullable=False),
        sa.Column("verifier_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("confirmed", sa.Boolean(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "verified_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    op.create_table(
        "crawled_sources",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("sighting_id", UUID(as_uuid=True), sa.ForeignKey("sightings.id"), nullable=True),
        sa.Column("source_name", sa.String(), nullable=False),
        sa.Column("source_url", sa.String(), nullable=False),
        sa.Column("raw_data", sa.Text(), nullable=True),
        sa.Column(
            "crawled_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("crawled_sources")
    op.drop_table("verifications")
    op.drop_table("sightings")
    op.drop_table("species")
    op.drop_table("users")
