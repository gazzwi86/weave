"""CE-V1-TASK-009 DoD invariant: the function registry is a derived
projection -- `GET /api/functions` and `GET /api/functions/{iri}` are the
only routes under the `/api/functions*` prefix. Writes go through
CE-WRITE-1 (`POST /api/operations/apply`) only; a second write path here
would let the registry and the RDF graph drift out of sync.
"""

from __future__ import annotations

from weave_backend import app

_MUTATING_METHODS = {"post", "put", "patch", "delete"}


def _functions_paths() -> dict[str, list[str]]:
    schema = app.openapi()
    return {
        path: list(methods.keys())
        for path, methods in schema["paths"].items()
        if path.startswith("/api/functions")
    }


def test_no_post_or_put_route_exists_under_functions_prefix() -> None:
    functions_paths = _functions_paths()
    assert functions_paths, "expected the registered /api/functions* routes"
    for path, methods in functions_paths.items():
        assert not _MUTATING_METHODS & set(methods), f"{path} exposes mutating method(s): {methods}"


def test_functions_routes_are_get_only() -> None:
    functions_paths = _functions_paths()
    assert set(functions_paths) == {"/api/functions", "/api/functions/{fn_iri}"}
    for methods in functions_paths.values():
        assert methods == ["get"]
