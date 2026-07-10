"""TASK-002 (build-engine EPIC-008): the 6th safety gate -- CE-BRAND-1
conformance (design tokens + VoiceRules), registered after `mutation`
(AC-1). Called as an explicit awaited step in `generate_app`, not folded
into the sync `GATE_PIPELINE` tuple: it needs async DB access
(PLAT-SETTINGS-1 `pass_bar`) and async CE-BRAND-1 HTTP calls, neither of
which the other 5 gates' `Callable[[str], GateResult]` shape supports
(Implementation Hints: "adds one gate callable, not pipeline logic").

Scoring formula is fixed by contracts.md SS CE-BRAND-1 -- cited, not
re-derived (Design Decisions table): `score = normal_passed / normal_total`
(1.0 if no normal rules), any critical-severity failure hard-fails
regardless of score.
"""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

import asyncpg
import httpx

from weave_backend.generation.gates import GateFailure, GateResult
from weave_backend.settings.resolver import SettingNotFound, resolve_setting
from weave_backend.settings.scope import InvalidScopeIri

if TYPE_CHECKING:
    from weave_backend.generation.service import GenerationContext

#: invariants.md / DoD "no hardcoded 0.90 literal" -- this is only the
#: fallback business default when PLAT-SETTINGS-1 has nothing set anywhere
#: in the cascade (same pattern as `requests/cost.py`'s DEFAULT_COST_CAP_USD).
DEFAULT_PASS_BAR = 0.90

_PASS_BAR_SETTING_NAME = "build.brand.pass_bar"  # noqa: S105 -- a settings key, not a secret

#: ponytail: token conformance MVP is a regex pass for literal hex colours /
#: raw px values in generated UI files, not a full closed-core allowlist
#: match against the fetched tokens payload (Implementation Hints: "a regex
#: pass ... is sufficient, don't build an AST-level design-token linter in
#: M2"). Upgrade path: match `_HEX_COLOR`/`_PX_LITERAL` hits against the
#: fetched `tokens` payload's actual allowed values once CE-BRAND-1's closed
#: core is consumed for real.
_SCANNED_SUFFIXES = (".ts", ".tsx", ".css")
_HEX_COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b")
_PX_LITERAL = re.compile(r"\b\d+px\b")

#: The one mechanically-evaluable VoiceRule assertion kind in the M2 CE
#: fixture catalogue (Implementation Hints). Any other kind -- prose voice/
#: tone rules included -- is `not_evaluable` (AC-6); we do NOT attempt LLM
#: evaluation of prose assertions.
_SCAN_ASSERTION_KIND = "token_scan"


@dataclass(frozen=True)
class EvaluatedRule:
    rule_id: str
    severity: str
    status: str  # "passed" | "failed" | "not_evaluable"


def _token_scan_status(staging_dir: str) -> str:
    """Reuses the SAST gate's file-walk shape (`gates.find_unconfirmed_model_ids`)
    over the staging tree.
    """
    for path in Path(staging_dir).rglob("*"):
        if path.is_file() and path.suffix in _SCANNED_SUFFIXES:
            text = path.read_text(errors="ignore")
            if _HEX_COLOR.search(text) or _PX_LITERAL.search(text):
                return "failed"
    return "passed"


def evaluate_rule(rule: dict[str, Any], staging_dir: str) -> EvaluatedRule:
    """AC-6: an assertion kind the checker can't mechanically evaluate is
    recorded `not_evaluable`, never silently skipped -- `decide_brand_gate`
    then counts it as a failure (failed-critical if the rule is critical).
    """
    assertion = rule.get("assertion") or {}
    kind = assertion.get("kind")
    status = _token_scan_status(staging_dir) if kind == _SCAN_ASSERTION_KIND else "not_evaluable"
    return EvaluatedRule(
        rule_id=str(rule.get("id")), severity=str(rule.get("severity")), status=status
    )


def decide_brand_gate(
    results: list[EvaluatedRule], pass_bar: float
) -> tuple[bool, float, list[str]]:
    """Pure pass/fail decision + score (contracts.md SS CE-BRAND-1) -- AC-2
    (critical hard-fail), AC-3 (pass_bar, raw-float `>=`, no rounding), AC-6
    (not_evaluable counts as failed). Returns `(passed, score,
    critical_failure_rule_ids)`.
    """
    critical_failures = [
        r.rule_id for r in results if r.severity == "critical" and r.status != "passed"
    ]
    normal = [r for r in results if r.severity == "normal"]
    score = (sum(1 for r in normal if r.status == "passed") / len(normal)) if normal else 1.0
    passed = not critical_failures and score >= pass_bar
    return passed, score, critical_failures


async def _resolve_pass_bar(
    conn: asyncpg.Connection, *, tenant_id: str, project_iri: str
) -> float:
    # `InvalidScopeIri` alongside `SettingNotFound`: `projects` has no
    # `domain_id` yet (tracked gap, see MEMORY.md
    # project_projects-domain-id-gap), so a bare `urn:weave:project:...`
    # IRI can't walk a real PLAT-SETTINGS-1 cascade -- same fallback
    # precedent as `build/typed_result.py`'s `get_retry_ceiling`.
    try:
        resolved = await resolve_setting(
            conn, tenant_id=tenant_id, key=_PASS_BAR_SETTING_NAME, context_iri=project_iri
        )
    except (SettingNotFound, InvalidScopeIri):
        return DEFAULT_PASS_BAR
    return float(resolved.value)


#: `record(tenant_id, ctx, status, payload)` -- injected so the recording
#: durability mechanism (own connection/transaction, see
#: `service._default_record_brand_gate`) is a Law-F seam tests can fake.
RecordBrandGate = Callable[[str, "GenerationContext", str, dict[str, object]], Awaitable[None]]


async def run_brand_gate(
    conn: asyncpg.Connection,
    ctx: GenerationContext,
    workspace: str,
    record: RecordBrandGate,
) -> GateResult:
    """AC-1..AC-6. Raises `GateFailure("brand_fail", ...)` on any failure
    path (critical rule, below pass_bar, CE-BRAND-1 unreachable) -- the
    existing M1 `except GateFailure` atomicity in `generate_app` handles
    cleanup/no-commit unchanged.
    """
    try:
        tokens_resp = await ctx.ce_client.get("/api/brand/tokens")
        tokens_resp.raise_for_status()
        rules_resp = await ctx.ce_client.get("/api/brand/voice-rules")
        rules_resp.raise_for_status()
        rules = rules_resp.json()
    except httpx.HTTPError:
        # AC-5: fail closed -- an unevaluable gate never passes.
        payload: dict[str, object] = {"reason": "ce_unavailable", "not_verified": True}
        await record(ctx.tenant_id, ctx, "failed", payload)
        raise GateFailure("brand_fail", **payload) from None

    results = [evaluate_rule(rule, workspace) for rule in rules]
    pass_bar = await _resolve_pass_bar(conn, tenant_id=ctx.tenant_id, project_iri=ctx.project_iri)
    passed, score, critical_failures = decide_brand_gate(results, pass_bar)

    result_payload: dict[str, object] = {
        "score": score,
        "critical_failures": critical_failures,
        "rules_evaluated": len(results),
    }
    await record(ctx.tenant_id, ctx, "passed" if passed else "failed", result_payload)
    if not passed:
        raise GateFailure("brand_fail", **result_payload)
    return GateResult(gate="brand", score=score)
