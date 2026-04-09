"""add sponsors table

Revision ID: b8e4d1f9a2c5
Revises: a9f3c2e8b1d4
Create Date: 2026-04-09 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = "b8e4d1f9a2c5"
down_revision: Union[str, None] = "a9f3c2e8b1d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "sponsors",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("tagline", sa.String(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("link_url", sa.String(), nullable=False),
        sa.Column("placement", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("starts_on", sa.Date(), nullable=True),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_sponsors_placement", "sponsors", ["placement"])
    op.create_index("ix_sponsors_is_active", "sponsors", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_sponsors_is_active", table_name="sponsors")
    op.drop_index("ix_sponsors_placement", table_name="sponsors")
    op.drop_table("sponsors")
