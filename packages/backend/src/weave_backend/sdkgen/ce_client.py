"""Fetch adapter for BE-SDK-1 (TASK-004) -- wraps the CE-READ-1 shapes/
named-selects, CE-FUNCTION-1, and CE-BRAND-1 inputs the generator pipeline
consumes (ADR-006 SS2). Every failure raises :class:`CeFetchError` naming
the input that failed (AC-6) -- the pipeline calls all five fetches before
creating a staging directory, so a fetch failure never leaves partial
output behind.

Plain ``httpx.Client`` (sync), not the async ``AsyncClient`` pattern used
by the FastAPI request-path CE clients (``briefs/ce_read_client.py``,
``projects/ce_version_client.py``): BE-SDK-1 runs as a standalone Fargate
batch task (ADR-006 SS1), not inside a request handler, and every other
step in the pipeline (Jinja2 render, subprocess validators) is already
synchronous -- async here would only add event-loop ceremony with no
concurrent I/O to overlap it against.

ADR-019 records the endpoint-shape assumption this client makes: a raw
Turtle ``/api/ontology/shapes`` endpoint distinct from the already-shipped
``/api/ontology/types`` JSON projection (``ontology/catalogue.py``), which
is too lossy (no datatype/sh:or/sh:in/sh:pattern/sh:class fidelity) for
BE-SDK-1's mapping table.
"""

from __future__ import annotations

import httpx

from weave_backend.sdkgen.errors import CeFetchError


class CeClient:
    def __init__(self, http: httpx.Client) -> None:
        self._http = http

    def _get(self, path: str, input_name: str) -> httpx.Response:
        try:
            response = self._http.get(path)
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise CeFetchError(input_name, str(exc)) from exc
        return response

    def shapes(self, version_iri: str) -> str:
        """Raw SHACL Turtle for the pinned version (ADR-019)."""
        return self._get(
            f"/api/ontology/shapes?version={version_iri}", "CE-READ-1 shapes"
        ).text

    def named_selects(self, version_iri: str) -> list[dict[str, object]]:
        body = self._get(
            f"/api/ontology/named-selects?version={version_iri}", "CE-READ-1 named-selects"
        ).json()
        selects = body.get("selects", []) if isinstance(body, dict) else []
        return selects if isinstance(selects, list) else []

    def functions(self) -> list[dict[str, object]]:
        body = self._get("/api/functions", "CE-FUNCTION-1 functions").json()
        functions = body.get("functions", []) if isinstance(body, dict) else []
        return functions if isinstance(functions, list) else []

    def function_schema(self, fn_iri: str) -> dict[str, object]:
        input_name = f"CE-FUNCTION-1 function {fn_iri}"
        return dict(self._get(f"/api/functions/{fn_iri}", input_name).json())

    def brand_tokens(self) -> dict[str, object]:
        return dict(self._get("/api/brand/tokens", "CE-BRAND-1 tokens").json())
