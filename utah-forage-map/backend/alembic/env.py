import os
import sys
from logging.config import fileConfig
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

from alembic import context

# Load .env from the backend directory
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Make sure app/ is importable when running alembic from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Alembic Config object
config = context.config

# Override sqlalchemy.url from environment
config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])

# Set up loggers from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import models so autogenerate can detect them
from app.database import Base  # noqa: E402
import app.models  # noqa: E402, F401 — registers all ORM classes on Base.metadata

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Emit SQL to stdout without a live DB connection."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations against a live DB connection."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
