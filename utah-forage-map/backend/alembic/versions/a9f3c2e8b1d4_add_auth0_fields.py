"""add auth0 fields to users

Revision ID: a9f3c2e8b1d4
Revises: d72381fdc0cf
Create Date: 2026-04-09 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a9f3c2e8b1d4"
down_revision: Union[str, None] = "d72381fdc0cf"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Allow hashed_password to be NULL (Auth0 users have no local password)
    op.alter_column("users", "hashed_password", nullable=True)

    # Auth0 subject identifier (e.g. "google-oauth2|123456789")
    op.add_column("users", sa.Column("auth0_id", sa.String(), nullable=True))
    op.create_unique_constraint("uq_users_auth0_id", "users", ["auth0_id"])
    op.create_index("ix_users_auth0_id", "users", ["auth0_id"])

    op.add_column("users", sa.Column("avatar_url", sa.String(), nullable=True))
    op.add_column("users", sa.Column("display_name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "display_name")
    op.drop_column("users", "avatar_url")
    op.drop_index("ix_users_auth0_id", table_name="users")
    op.drop_constraint("uq_users_auth0_id", "users", type_="unique")
    op.drop_column("users", "auth0_id")
    op.alter_column("users", "hashed_password", nullable=False)
