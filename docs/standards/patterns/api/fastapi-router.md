---
type: Coding Standard
title: "API — FastAPI async router (python)"
description: APIRouter with Pydantic v2, Depends(get_session), response_model, and the Weave error envelope (404 + SHACL 422).
tags: [standards, patterns, api, python]
timestamp: 2026-07-01
resource: docs/standards/patterns/api/fastapi-router.md
topic: api
stack: python
verification: "all 5 python blocks: py_compile OK; ruff check clean (unresolved app.* imports expected, not flagged)"
---

# API — FastAPI async router (python)

Golden shape for a Weave REST resource: an `APIRouter` under `/api/v1`, Pydantic v2 schemas,
an async DB session injected via `Depends(get_session)`, `response_model` on every route, and
domain errors that render the single Weave envelope `{error:{code,message,status,details?,request_id}}`
— including 404 (not found) and 422 (SHACL validate-before-commit, graph never mutated).

```python
# app/routers/actors.py
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import NotFoundError
from app.models.actor import Actor
from app.schemas.actor import ActorCreate, ActorRead
from app.services.actor_service import ActorService

router = APIRouter(prefix="/api/v1/actors", tags=["actors"])


@router.get("/{actor_id}", response_model=ActorRead)
async def get_actor(
    actor_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> Actor:
    actor = await ActorService(session).get(actor_id)
    if actor is None:
        raise NotFoundError(f"actor {actor_id} not found")  # -> 404 envelope
    return actor  # ORM row, coerced to ActorRead by response_model


@router.post("/", response_model=ActorRead, status_code=status.HTTP_201_CREATED)
async def create_actor(
    payload: ActorCreate,
    session: AsyncSession = Depends(get_session),
) -> Actor:
    # SHACL validation runs in the service before any write; a violation -> 422.
    return await ActorService(session).create(payload)
```

```python
# app/schemas/actor.py  (Pydantic v2)
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ActorKind(StrEnum):
    PERSON = "person"
    SYSTEM = "system"


class ActorCreate(BaseModel):
    """Create payload; further validated against the SHACL shape in the service."""

    label: str = Field(min_length=1, max_length=200)
    kind: ActorKind


class ActorRead(BaseModel):
    """Actor as returned to clients; coerced from the ORM row by response_model."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    label: str
    kind: ActorKind
```

```python
# app/services/actor_service.py  (excerpt — validate-before-commit)
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ShaclViolation
from app.models.actor import Actor
from app.ontology.shacl import validate_actor
from app.schemas.actor import ActorCreate


class ActorService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, actor_id: UUID) -> Actor | None:
        return await self._session.get(Actor, actor_id)

    async def create(self, payload: ActorCreate) -> Actor:
        # Validate BEFORE mutating; on failure the graph/row is never written (422).
        report = validate_actor(payload)
        if report:
            raise ShaclViolation("actor failed SHACL validation", details=report)
        actor = Actor(**payload.model_dump())
        self._session.add(actor)
        await self._session.commit()
        return actor
```

```python
# app/errors.py  — the single Weave error envelope (api-conventions.md)
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ApiError(Exception):
    """Base domain error; every subclass renders as the Weave envelope."""

    code = "internal_error"
    http_status = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(self, message: str, details: list[dict[str, str]] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class NotFoundError(ApiError):
    code = "not_found"
    http_status = status.HTTP_404_NOT_FOUND


class ShaclViolation(ApiError):
    code = "shacl_violation"  # 422 — validate-before-commit; never mutate on 422
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY


class RequestInvalid(ApiError):
    code = "validation_error"  # 422 — request shape (Pydantic) failed
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY


def _envelope(exc: ApiError, request: Request) -> JSONResponse:
    error: dict[str, object] = {
        "code": exc.code,
        "message": exc.message,  # human-readable; never secrets/PII
        "status": exc.http_status,
        "request_id": request.headers.get("x-request-id", ""),
    }
    if exc.details is not None:
        error["details"] = exc.details
    return JSONResponse(status_code=exc.http_status, content={"error": error})


def install_error_handlers(app: FastAPI) -> None:
    """Route every error through {error:{code,message,status,details?,request_id}}."""

    @app.exception_handler(ApiError)
    async def _on_api_error(request: Request, exc: ApiError) -> JSONResponse:
        return _envelope(exc, request)

    @app.exception_handler(RequestValidationError)
    async def _on_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        # FastAPI's default {"detail": ...} is reshaped into the same envelope.
        err = RequestInvalid("request validation failed")
        err.details = [
            {"loc": ".".join(map(str, e["loc"])), "msg": str(e["msg"])}
            for e in exc.errors()
        ]
        return _envelope(err, request)
```

```python
# app/db.py  — async session, injected via Depends (never built inside a handler)
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings  # DSN sourced from AWS Secrets Manager, never hardcoded

engine = create_async_engine(settings.database_url, echo=False)
_Session = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with _Session() as session:
        yield session
```

**Why:** `Depends(get_session)` scopes the async session to the request and closes it on exit;
`response_model=ActorRead` serialises the schema (not the ORM row), so no lazy-load leaks. Domain
errors (`NotFoundError`, `ShaclViolation`) subclass `ApiError`, so one handler yields the canonical
envelope for every failure and clients branch on the stable `code` slug, never the message.
**Security:** validate-before-commit means a 422 SHACL violation never mutates the graph/row;
`message` carries no secrets/PII; DSN comes from Secrets Manager, never a literal or `.env`.
**Anti-patterns:** returning FastAPI's bare `{"detail": ...}` instead of the envelope; passing the
session as a plain argument instead of `Depends`; committing before validation (mutate-then-reject);
returning the ORM object without a `response_model` (leaks columns / triggers lazy loads).
