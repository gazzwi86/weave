"""TASK-025: Explorer Persistence Service -- comments (`explorer_comments`,
migration 0064), covering AC-6 (server-stamped `author`, spoof rejected --
ADR-019 pattern, same guard shape as `routers/views.py::create_view`'s
name/definition checks). Same container, same RLS/txn helper
(`explorer.persistence.explorer_connection`) as `routers/views.py`.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query

from weave_backend.auth.dependencies import Principal, get_current_principal
from weave_backend.explorer.persistence import explorer_connection
from weave_backend.schemas.comments import CommentCreateRequest, CommentOut

router = APIRouter(prefix="/api", tags=["comments"])

_VALID_TARGET_KINDS = ("node", "view")

_INSERT_COMMENT_SQL = """
    INSERT INTO explorer_comments (tenant_id, target_kind, target_ref, author, body)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING comment_id
"""

_LIST_COMMENTS_SQL = """
    SELECT comment_id, target_kind, target_ref, author, body, created_at
    FROM explorer_comments
    WHERE tenant_id = $1 AND target_kind = $2 AND target_ref = $3
    ORDER BY created_at ASC
"""


def _reject_spoofed_author(body: CommentCreateRequest) -> None:
    """AC-6: a client-supplied `author` field must 400, never silently be
    dropped or overwritten -- `extra="allow"` on the schema is exactly what
    lets it survive parsing so this check can see it.
    """
    if body.model_extra and "author" in body.model_extra:
        raise HTTPException(400, {"error": "author_not_allowed"})


def _require_target_kind(value: Any) -> str:
    if not isinstance(value, str) or value not in _VALID_TARGET_KINDS:
        raise HTTPException(422, {"error": "invalid_target_kind"})
    return value


def _require_target_ref(value: Any) -> str:
    if not isinstance(value, str) or not value:
        raise HTTPException(422, {"error": "invalid_target_ref"})
    return value


def _require_comment_body(value: Any) -> str:
    if not isinstance(value, str) or not value:
        raise HTTPException(400, {"error": "empty_body"})
    return value


@router.post("/comments", status_code=201)
async def create_comment(
    body: CommentCreateRequest,
    principal: Annotated[Principal, Depends(get_current_principal)],
) -> dict[str, str]:
    _reject_spoofed_author(body)
    target_kind = _require_target_kind(body.target_kind)
    target_ref = _require_target_ref(body.target_ref)
    comment_body = _require_comment_body(body.body)

    async with explorer_connection(principal.tenant_id) as conn:
        row = await conn.fetchrow(
            _INSERT_COMMENT_SQL,
            principal.tenant_id,
            target_kind,
            target_ref,
            principal.principal_iri,
            comment_body,
        )
    return {"comment_id": str(row["comment_id"])}


@router.get("/comments", response_model=list[CommentOut])
async def list_comments(
    principal: Annotated[Principal, Depends(get_current_principal)],
    target_kind: str = Query(default=""),
    target_ref: str = Query(default=""),
) -> list[CommentOut]:
    if target_kind not in _VALID_TARGET_KINDS or not target_ref:
        raise HTTPException(400, {"error": "missing_target"})

    async with explorer_connection(principal.tenant_id) as conn:
        rows = await conn.fetch(_LIST_COMMENTS_SQL, principal.tenant_id, target_kind, target_ref)
    return [
        CommentOut(
            comment_id=str(row["comment_id"]),
            target_kind=row["target_kind"],
            target_ref=row["target_ref"],
            author=row["author"],
            body=row["body"],
            created_at=row["created_at"],
        )
        for row in rows
    ]
