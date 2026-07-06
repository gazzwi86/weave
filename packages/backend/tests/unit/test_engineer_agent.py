"""BE-TASK-008 QA gap: `engineer_agent.generate_workspace` is the *only*
code that actually produces AC-2's OpenAPI -> FastAPI -> Next.js structure,
but every other test in this suite injects its own fake
`generate_workspace_fn` (Law F DELEGATE seam), so this module was never
exercised. AC-2's mapped test
(`test_generation_produces_openapi_fastapi_nextjs_structure`) does not
exist under that name and the integration test it's mapped to only writes
a bare `openapi.yaml` stub -- it asserts nothing about per-entity-kind
structure. These tests close that gap directly against the real function.
"""

from __future__ import annotations

import json
from pathlib import Path

from weave_backend.generation.engineer_agent import build_generation_prompt, generate_workspace


async def test_generate_workspace_produces_one_route_and_page_per_entity_kind(
    tmp_path: Path,
) -> None:
    """AC-2: output structure matches the project's entity types from the
    BPMO graph -- one OpenAPI path, one FastAPI route file, one Next.js page
    per `entity_kinds` entry.
    """
    await generate_workspace(
        prompt="ignored",
        output_dir=str(tmp_path),
        bpmo={"entity_kinds": ["widget", "order"]},
    )

    openapi = json.loads((tmp_path / "openapi.yaml").read_text())
    assert set(openapi["paths"]) == {"/widgets", "/orders"}

    assert (tmp_path / "backend" / "widget_routes.py").exists()
    assert (tmp_path / "backend" / "order_routes.py").exists()

    assert (tmp_path / "frontend" / "app" / "widgets" / "page.tsx").exists()
    assert (tmp_path / "frontend" / "app" / "orders" / "page.tsx").exists()


async def test_generate_workspace_falls_back_to_resource_kind_when_bpmo_has_no_kinds(
    tmp_path: Path,
) -> None:
    """Edge case: an ungrounded/empty BPMO context (no `entity_kinds` or
    `kinds` key) must not crash generation -- it falls back to a single
    generic `resource` kind rather than producing an empty workspace.
    """
    await generate_workspace(prompt="ignored", output_dir=str(tmp_path), bpmo={})

    openapi = json.loads((tmp_path / "openapi.yaml").read_text())
    assert set(openapi["paths"]) == {"/resources"}
    assert (tmp_path / "backend" / "resource_routes.py").exists()
    assert (tmp_path / "frontend" / "app" / "resources" / "page.tsx").exists()


def test_build_generation_prompt_embeds_brief_title_and_bpmo_context() -> None:
    prompt = build_generation_prompt(
        {"title": "Widget list"}, {"entity_kinds": ["widget"]}
    )

    assert "Widget list" in prompt
    assert "widget" in prompt
