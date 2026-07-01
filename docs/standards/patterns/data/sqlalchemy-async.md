---
type: Coding Standard
title: "Data — SQLAlchemy 2.0 Typed Async (python)"
description: "Golden pattern for SQLAlchemy 2.0 typed async against Aurora Postgres: DeclarativeBase, Mapped/mapped_column, async_sessionmaker, tenant-scoped repository."
tags: [standards, patterns, data, python]
timestamp: 2026-07-01
resource: docs/standards/patterns/data/sqlalchemy-async.md
topic: data
stack: python
verification: "python3 -m py_compile: OK; uvx ruff check (--target-version py312 --select E,W,F,I,B,C90,UP,PLR --line-length 100 --config lint.isort.known-first-party=['app']): All checks passed! (known-first-party mirrors ruff-strict.md so the app.* import stays in its own group)"
---

# Data — SQLAlchemy 2.0 Typed Async (python)

The house style for relational state in Aurora Postgres: 2.0 typed models, an
`async_sessionmaker`, and a repository that always injects the tenant predicate.

```python
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.config import settings  # DSN from AWS Secrets Manager; never a literal or .env


class Base(DeclarativeBase):
    pass


class Entity(Base):
    __tablename__ = "entities"  # snake_case plural

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    tenant_id: Mapped[UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    iri: Mapped[str] = mapped_column(unique=True, index=True)
    label: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# DSN sourced from AWS Secrets Manager (via settings); no embedded credentials, no literal DSN.
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
Session = async_sessionmaker(engine, expire_on_commit=False)


class EntityRepository:
    """Isolates DB access; the tenant predicate is always injected."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_iri(self, tenant_id: UUID, iri: str) -> Entity | None:
        stmt = select(Entity).where(
            Entity.tenant_id == tenant_id,
            Entity.iri == iri,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
```

**Why:** `Mapped[...]` + `mapped_column(...)` is the only supported 2.0 typed style (never
legacy `Column(...)`); `async_sessionmaker` with `expire_on_commit=False` keeps loaded
attributes usable after commit; the repository owns DB logic so services stay persistence-agnostic.

**Security:** Every tenant-owned table carries `tenant_id` and the predicate is injected by the
repository, never ad-hoc — this is the cross-tenant isolation boundary. Queries use the ORM
expression API (bound params), never string-concatenated SQL. The DSN and credentials come from
AWS Secrets Manager, never hard-coded or in `.env`.

**Anti-patterns:** legacy `Column(...)`; naive datetimes (always `DateTime(timezone=True)` UTC);
sync `Session`/`session.query`; `Base.metadata.create_all()` (schema changes ship as Alembic
revisions); a repository query without the `tenant_id` predicate.
