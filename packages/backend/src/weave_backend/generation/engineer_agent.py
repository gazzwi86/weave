"""BE-TASK-008 (build-engine EPIC-008): the Engineer-agent DELEGATE seam.

Mirrors `build/orchestrator.py`'s `default_dispatch_pdac` precedent
(BE-TASK-006): proves the shape of the call (grounded prompt in, workspace
artefacts out) without a full LLM-output-to-app-scaffold parser -- real
Sonnet-driven content generation is a follow-up task's scope, the same
deferral this codebase already established for PDAC content. This default
writes a minimal-but-structurally-real skeleton (an OpenAPI path + one
FastAPI route file + one Next.js page per BPMO entity kind) so AC-2's
"structure matches the project's entity types" holds for real. Tests supply
their own `generate_workspace_fn` (Law F) -- this module is never exercised
in the test suite.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_UNGROUNDED_ENTITY_KIND = "resource"


def build_generation_prompt(brief: dict[str, Any], bpmo: dict[str, Any]) -> str:
    """The DELEGATE prompt for a real agent call (task brief's pseudocode
    names this function explicitly) -- unused by the M1 skeleton below, kept
    so a real agent implementation can drop in without a signature change.
    """
    title = brief.get("title", "untitled")
    return (
        f"Generate a Next.js + FastAPI application for task {title!r}, "
        f"grounded in this BPMO project graph context: {json.dumps(bpmo)}"
    )


def _entity_kinds(bpmo: dict[str, Any]) -> list[str]:
    kinds = bpmo.get("entity_kinds") or bpmo.get("kinds")
    if not kinds:
        return [_UNGROUNDED_ENTITY_KIND]
    return [str(kind) for kind in kinds]


def _write_openapi(root: Path, kinds: list[str]) -> None:
    paths = {f"/{kind}s": {"get": {"summary": f"List {kind}s"}} for kind in kinds}
    (root / "openapi.yaml").write_text(json.dumps({"openapi": "3.1.0", "paths": paths}))


def _write_backend(root: Path, kinds: list[str]) -> None:
    backend = root / "backend"
    backend.mkdir(parents=True, exist_ok=True)
    for kind in kinds:
        (backend / f"{kind}_routes.py").write_text(
            f'"""FastAPI routes for {kind} (Weave M1 generation skeleton)."""\n'
        )


def _write_frontend(root: Path, kinds: list[str]) -> None:
    for kind in kinds:
        page_dir = root / "frontend" / "app" / f"{kind}s"
        page_dir.mkdir(parents=True, exist_ok=True)
        (page_dir / "page.tsx").write_text(
            f"export default function {kind.capitalize()}sPage() {{ return null; }}\n"
        )


async def generate_workspace(*, prompt: str, output_dir: str, bpmo: dict[str, Any]) -> None:
    """Default DELEGATE implementation -- see module docstring for scope."""
    del prompt  # unused by the M1 skeleton -- a real agent call is a follow-up
    root = Path(output_dir)
    kinds = _entity_kinds(bpmo)
    _write_openapi(root, kinds)
    _write_backend(root, kinds)
    _write_frontend(root, kinds)
