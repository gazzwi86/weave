---
type: Coding Standard
title: Code Style — Coding Standard
description: "Universal code-style conventions: readability, naming, structure."
tags: [standards, code-style]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/code-style.md
---

# Code Style Standards

## General Principles

- Write code for humans first, machines second
- Prefer explicit over implicit
- Keep functions small and focused (max 50 lines)
- Keep files focused (max 300 lines)
- Use descriptive names -- code should read like prose

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (components) | PascalCase | `EntityCard.tsx` |
| Files (utilities) | camelCase | `graphUtils.ts` |
| Files (tests) | Match source + `.test` | `EntityCard.test.tsx` |
| Components | PascalCase | `EntityCard` |
| Functions | camelCase | `resolveLabel` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_GRAPH_URI` |
| Types/Interfaces | PascalCase | `EntityNode` |
| CSS classes | kebab-case | `entity-card` |

## TypeScript

- Strict mode enabled (`"strict": true`)
- Prefer `interface` over `type` for object shapes
- Use `const` by default, `let` only when reassignment needed
- Never use `any` -- use `unknown` and narrow
- Export types alongside their implementations

## React

- Functional components only
- Props interface defined above component
- Destructure props in function signature
- Custom hooks for shared logic (`use` prefix)
- Collocate tests with source files in `__tests__/`

## TSDoc

All public functions, components, hooks, and types must have a TSDoc block.
Internal helpers may omit if name and types are self-evident.

```typescript
/**
 * Resolves the display label for a graph entity, falling back to the IRI fragment.
 *
 * @param entity - The entity node returned by the SPARQL query.
 * @param locale - BCP-47 language tag to prefer (e.g. "en").
 * @returns The preferred label string, never empty.
 */
export function resolveLabel(entity: EntityNode, locale: string): string {
  // ...
}
```

## File Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # Shared UI components
│   ├── ui/                # Base UI primitives
│   └── features/          # Feature-specific components
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, helpers, services
├── types/                  # Shared TypeScript types
└── styles/                 # Global styles
```

## Imports

Order (enforced by ESLint):

1. React/Next.js
2. External packages
3. Internal modules (`@/`)
4. Relative imports
5. Type imports

---

## Python

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Modules / packages | `snake_case` | `ontology_store.py` |
| Classes | `PascalCase` | `OntologyStore` |
| Functions / methods | `snake_case` | `validate_shape` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_GRAPH_URI` |
| Type aliases | `PascalCase` | `TripleSet` |
| Private members | leading `_` | `_client` |

### Type hints

Use Python 3.12+ built-in generics — no `from __future__ import annotations` needed:

```python
# Good — 3.12+ syntax
def find_entities(type_uri: str | None = None) -> list[dict[str, str]]:
    ...

# Bad — legacy typing module
from typing import List, Optional
def find_entities(type_uri: Optional[str] = None) -> List[dict]:
    ...
```

All function signatures must be fully typed. Return types are mandatory — never omit.

### Pydantic v2

```python
from pydantic import BaseModel, Field, model_validator

class EntityCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    type_uri: str = Field(..., alias="typeUri")
    description: str | None = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def label_is_not_blank(self) -> "EntityCreate":
        if not self.label.strip():
            raise ValueError("label must not be blank")
        return self
```

- Use `Field(...)` not `Field(default=...)` for required fields.
- Use `model_config = ConfigDict(...)` not the inner `class Config`.
- Validators use `@model_validator` (v2); avoid `@validator` (v1 compat, deprecated).
- Never use `.dict()` — use `.model_dump()`.

### FastAPI patterns

```python
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas import EntityCreate, EntityRead
from app.services.entities import EntityService

router = APIRouter(prefix="/entities", tags=["entities"])

@router.post("", response_model=EntityRead, status_code=status.HTTP_201_CREATED)
async def create_entity(
    payload: EntityCreate,
    service: EntityService = Depends(),
) -> EntityRead:
    return await service.create(payload)
```

- Routers live in `app/routers/`; services in `app/services/`.
- Inject dependencies via `Depends()` — never instantiate services inside route handlers.
- Use `status.HTTP_*` constants, not bare integers.
- Return typed response models; the route decorator `response_model` is for OpenAPI docs only.

### Imports (enforced by ruff `I`)

```python
# 1. stdlib
import asyncio
from pathlib import Path

# 2. third-party
import httpx
from fastapi import APIRouter
from rdflib import Graph, URIRef

# 3. internal
from app.ontology.store import OntologyStore
from app.schemas import EntityCreate
```

### SQLAlchemy models

Relational state lives in Aurora PostgreSQL via SQLAlchemy async (see CLAUDE.md stack).
These conventions gate every generated model.

- Use the 2.0 typed style: `Mapped[...]` + `mapped_column(...)`. Never the legacy
  `Column(...)` class-attribute style.
- One declarative `Base` per service; models live in `app/models/`, one aggregate per file.
- Tables are `snake_case` plural (`audit_events`, `decision_log_entries`). Columns are
  `snake_case`. Primary keys are `id` unless a domain key is mandated.
- Every table carries `created_at` (server-default `now()`). Mutable tables also carry
  `updated_at`; append-only tables (below) MUST NOT carry `updated_at` — there are no updates.
- Timestamps are `TIMESTAMP(timezone=True)` and always UTC. Never store naive datetimes.
- Foreign keys are explicit, named, and indexed; declare `ondelete=` intent. Do not rely on
  ORM-side cascade for audit/decision-log references — those rows must survive their parents.
- All access is async: `AsyncSession`, `async with`, `await session.execute(...)`.
- Never build SQL by string concatenation; use bound parameters or the ORM expression API
  (`security.md`: parameterised queries only).

```python
from datetime import datetime
from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class Entity(Base):
    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(primary_key=True)
    iri: Mapped[str] = mapped_column(unique=True, index=True)
    label: Mapped[str]
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

### Alembic migrations

Every schema change ships as an Alembic revision. No schema drift; the database is whatever
the migrations produce.

- One migration per logical change; revisions live in `migrations/versions/`.
- Revision messages are conventional-commit style (`alembic revision -m "add audit_events table"`).
- Every `upgrade()` has a working `downgrade()`. If a change is genuinely irreversible (e.g.
  installing an append-only trigger that data now depends on), `downgrade()` must `raise
  NotImplementedError` with a one-line reason — never leave it as a silent `pass`.
- DDL only in migrations. Never `Base.metadata.create_all()` against a real database; that
  bypasses version history.
- Raw SQL for constraints/triggers/grants uses `op.execute(...)` with the SQL as a module-level
  constant so it is reviewable and testable.
- Migrations are tested: CI runs `alembic upgrade head` then `alembic downgrade base` on a
  throwaway database to prove both directions apply cleanly.

### Append-only / immutable tables

Audit and decision-log tables are **append-only and tamper-evident**. This backs the single
platform audit service `PLAT-AUDIT-1` (see `docs/specs/_inter-engine-contracts.md`, lines
100-108), whose contract requires append-only enforced *at the DB-constraint level*, deletes
rejected by the database, and the rejected attempt itself logged. Per that contract there is
ONE store: Build's decision-log and Events' run-log are filtered **views** over it, not
independent tables — generated code must not create rival audit stores.

The Constitution Engine prototype establishes the intent — an append-only history sidecar and
PROV stamping (`prototypes/weave-prototype/backend/app/ontology/store.py`,
`record_history_event` / `stamp_activity`, lines 451-490) with a content hash
(`_triple_hash`, line 40). The conventions below promote that intent to DB-enforced
guarantees on Aurora PostgreSQL; the trigger mechanism is net-new from the `PLAT-AUDIT-1` spec
and has no prototype precedent.

**Append-only tables MUST:**

1. Carry a monotonic `seq BIGINT` (sequence-backed), an `ts` UTC timestamp, the
   `actor_principal_iri` (from `PLAT-IDENTITY-1`), and a `signature`.
2. Reject `UPDATE` and `DELETE` at the database, not just in application code. Use BOTH a
   `REVOKE` (defence in depth against the app role) AND a `BEFORE UPDATE OR DELETE` trigger
   that raises and logs the attempt to a separate `audit_tamper_attempts` table.
3. Hash-chain each row: store `prev_hash` and `row_hash`, where
   `row_hash = sha256(prev_hash || canonical_serialisation(payload))`. A broken chain proves
   tampering even if a DBA bypasses the trigger. The `signature` signs `row_hash` under the
   platform signing key (single scheme per the contract — do not invent per-engine keys).
4. Never expose mutating ORM methods. The model is insert-only; there is no
   `session.merge`, no `update()`, no `delete()` path in generated services.

```python
# migrations/versions/XXXX_audit_events_append_only.py
from alembic import op

REJECT_MUTATION_FN = """
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger AS $$
BEGIN
    -- Log the rejected attempt BEFORE refusing it (contract: "the attempt itself logged").
    INSERT INTO audit_tamper_attempts (table_name, operation, attempted_by, attempted_at, old_row)
    VALUES (TG_TABLE_NAME, TG_OP, current_user, now(), to_jsonb(OLD));
    RAISE EXCEPTION 'append-only table %: % is forbidden', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;
"""

INSTALL_TRIGGER = """
CREATE TRIGGER audit_events_no_mutation
    BEFORE UPDATE OR DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
"""

REVOKE_GRANTS = "REVOKE UPDATE, DELETE ON audit_events FROM weave_app;"

def upgrade() -> None:
    op.execute(REJECT_MUTATION_FN)
    op.execute(INSTALL_TRIGGER)
    op.execute(REVOKE_GRANTS)

def downgrade() -> None:
    raise NotImplementedError(
        "audit_events is append-only by contract (PLAT-AUDIT-1); the immutability "
        "guarantee must not be reversible in a migration."
    )
```

**Testable guarantees (these gate the generated code):**

- An integration test issues `UPDATE` and `DELETE` against an audit row and asserts BOTH raise
  a database error AND that a matching row appears in `audit_tamper_attempts`.
- A test inserts three rows and asserts the hash-chain verifies, then mutates one row's stored
  hash directly (bypassing the trigger via a superuser fixture) and asserts chain verification
  fails.
- A test asserts the generated service layer exposes no update/delete method for any
  append-only model.

---
