"""BE-TASK-006 (build-engine EPIC-011) AC-1/AC-2/AC-3: preflight
credential-reference check. Collaborators injected via `PreflightDeps`
(same precedent as `RepoBootstrapDeps`) -- no DB/audit patching needed at
this level; the real `record_gate`/`fire_hitl_gate` wiring is proven by
`tests/integration/test_preflight.py`.

AC-3's "never `get_secret_value`" test goes one level deeper than the
others: it exercises the *real* `describe_secret` (default dep) against a
boto3 client that explodes if `get_secret_value` is ever called, so this
test would fail if a future change wired preflight to the wrong secrets
function -- not just to a nice-looking mock.
"""

from __future__ import annotations

from typing import Any

import pytest

from weave_backend.build.hitl import HitlGateContext
from weave_backend.build.preflight import (
    DEFAULT_PREFLIGHT_DEPS,
    PreflightDeps,
    PreflightRequest,
    RequiredRef,
    RunHalted,
    preflight,
    required_refs,
)

_TENANT = "tenant-preflight"
_PROJECT_IRI = "urn:weave:project:tenant-preflight:acme"
_RUN_ID = "run-1"
_TOKEN_REF = "weave/tenant-preflight/scm/acme/github/token"


def _request(refs: tuple[RequiredRef, ...]) -> PreflightRequest:
    return PreflightRequest(
        tenant_id=_TENANT,
        project_iri=_PROJECT_IRI,
        run_id=_RUN_ID,
        phase="run_start",
        refs=refs,
    )


def _deps(
    *, describe_secret_fn: Any = None, record_gate_fn: Any = None, fire_hitl_gate_fn: Any = None
) -> tuple[PreflightDeps, list[Any], list[HitlGateContext]]:
    gate_calls: list[Any] = []
    hitl_calls: list[HitlGateContext] = []

    async def _default_record_gate(_conn: Any, record: Any) -> None:
        gate_calls.append(record)

    async def _default_fire_hitl(_conn: Any, ctx: HitlGateContext) -> None:
        hitl_calls.append(ctx)

    deps = PreflightDeps(
        describe_secret_fn=describe_secret_fn or DEFAULT_PREFLIGHT_DEPS.describe_secret_fn,
        record_gate_fn=record_gate_fn or _default_record_gate,
        fire_hitl_gate_fn=fire_hitl_gate_fn or _default_fire_hitl,
    )
    return deps, gate_calls, hitl_calls


# --- AC-3: existence-only, never the secret value --------------------------


async def test_preflight_never_calls_get_secret_value(monkeypatch: pytest.MonkeyPatch) -> None:
    class _ExplodingOnValueClient:
        def describe_secret(self, *, SecretId: str) -> dict[str, str]:
            return {"Name": SecretId}

        def get_secret_value(self, *, SecretId: str) -> dict[str, str]:
            raise AssertionError("preflight must never call get_secret_value")

    monkeypatch.setattr(
        "weave_backend.repo_bootstrap.secrets.boto3.client",
        lambda *a, **kw: _ExplodingOnValueClient(),
    )
    deps, gate_calls, hitl_calls = _deps()

    await preflight(object(), _request(required_refs(_TOKEN_REF)), deps=deps)

    assert gate_calls[0].result == "PASS"
    assert hitl_calls == []


# --- non-critical refs are warnings, not halts ------------------------------


async def test_preflight_classifies_noncritical_missing_ref_as_warning_not_halt() -> None:
    async def _always_missing(_name: str) -> bool:
        return False

    deps, gate_calls, hitl_calls = _deps(describe_secret_fn=_always_missing)
    refs = (RequiredRef(name="weave/tenant-preflight/optional/ref", critical=False),)

    await preflight(object(), _request(refs), deps=deps)

    assert hitl_calls == []
    assert gate_calls[0].result == "FAIL"
    assert gate_calls[0].payload["refs"] == [
        {"ref": "weave/tenant-preflight/optional/ref", "ok": False, "critical": False}
    ]


# --- AC-2: a missing critical ref halts fail-closed to HITL -----------------


async def test_preflight_halts_and_raises_on_missing_critical_ref() -> None:
    async def _always_missing(_name: str) -> bool:
        return False

    deps, gate_calls, hitl_calls = _deps(describe_secret_fn=_always_missing)
    refs = required_refs(_TOKEN_REF)

    with pytest.raises(RunHalted):
        await preflight(object(), _request(refs), deps=deps)

    assert gate_calls[0].result == "FAIL"
    assert hitl_calls[0].task_id == f"run:{_RUN_ID}"
    evidence = hitl_calls[0].evidence
    assert evidence is not None
    assert _TOKEN_REF in evidence


# --- required_refs: a data table, not branching logic -----------------------


def test_required_refs_returns_scm_token_as_critical_when_set() -> None:
    refs = required_refs(_TOKEN_REF)

    assert refs == (RequiredRef(name=_TOKEN_REF, critical=True),)


def test_required_refs_returns_empty_when_no_token_ref_configured() -> None:
    assert required_refs(None) == ()
