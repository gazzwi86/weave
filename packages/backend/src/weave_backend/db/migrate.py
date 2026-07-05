"""Tiny hand-rolled SQL migration runner.

ponytail: no ORM/Alembic exists yet in this codebase and this task only
needs 4 tables + RLS policies -- plain numbered `.sql` files applied in
order and tracked in a `schema_migrations` table is the leanest fit. If a
future task needs schema-diffing/rollback machinery, promote to
SQLAlchemy + Alembic then (that's the standard pairing, not this).

Runs as the migration/admin role (``POSTGRES_MIGRATION_USER``, defaults to
the compose superuser `weave`) since it needs `CREATE ROLE`/DDL privileges
that the non-superuser `weave_app` runtime role intentionally lacks.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import asyncpg

MIGRATIONS_DIR = Path(__file__).resolve().parents[3] / "migrations"


def _dsn(user: str) -> str:
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", os.environ.get("WEAVE_PG_PORT", "5432"))
    database = os.environ.get("POSTGRES_DB", "weave")
    return f"postgresql://{user}@{host}:{port}/{database}"


async def run_migrations() -> list[str]:
    """Apply any `migrations/*.sql` not yet recorded in `schema_migrations`,
    in filename order, one transaction each. Returns the filenames applied
    this run (empty if already up to date).
    """
    user = os.environ.get("POSTGRES_MIGRATION_USER", "weave")
    conn = await asyncpg.connect(_dsn(user))
    applied: list[str] = []
    try:
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations ("
            "filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
        )
        already = {
            row["filename"] for row in await conn.fetch("SELECT filename FROM schema_migrations")
        }
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            if path.name in already:
                continue
            async with conn.transaction():
                await conn.execute(path.read_text())
                await conn.execute(
                    "INSERT INTO schema_migrations (filename) VALUES ($1)", path.name
                )
            applied.append(path.name)
    finally:
        await conn.close()
    return applied


def main() -> None:
    applied = asyncio.run(run_migrations())
    print(f"applied {len(applied)} migration(s): {applied}")


if __name__ == "__main__":
    main()
