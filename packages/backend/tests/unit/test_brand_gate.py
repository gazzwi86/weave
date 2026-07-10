"""TASK-002 (build-engine EPIC-008) unit tests for the brand gate's pure
scoring/decision logic (AC-2, AC-3, AC-6) -- `evaluate_rule` and
`decide_brand_gate` need no DB/HTTP, so these are plain function tests
(Law F: `run_brand_gate`'s CE-BRAND-1/PLAT-SETTINGS-1 orchestration is
covered end-to-end via `generate_app` in `test_generation_service.py` and
`tests/integration/test_generation_api.py`).
"""

from __future__ import annotations

from weave_backend.generation.brand_gate import EvaluatedRule, decide_brand_gate, evaluate_rule


def _rule(status: str, severity: str = "normal", rule_id: str = "r1") -> EvaluatedRule:
    return EvaluatedRule(rule_id=rule_id, severity=severity, status=status)


def test_should_fail_brand_gate_on_one_critical_rule_failure_despite_score_1_0() -> None:
    results = [
        _rule("passed", severity="normal", rule_id="normal-1"),
        _rule("failed", severity="critical", rule_id="crit-1"),
    ]
    passed, score, critical_failures = decide_brand_gate(results, pass_bar=0.90)
    assert score == 1.0
    assert passed is False
    assert critical_failures == ["crit-1"]


def test_should_pass_at_exactly_the_configured_pass_bar() -> None:
    # 9/10 normal rules pass == 0.90 exactly -- `>=`, not rounded (AC-3).
    results = [_rule("passed", rule_id=f"n{i}") for i in range(9)] + [_rule("failed", rule_id="n9")]
    passed, score, critical_failures = decide_brand_gate(results, pass_bar=0.90)
    assert score == 0.9
    assert passed is True
    assert critical_failures == []


def test_should_fail_just_below_the_configured_pass_bar() -> None:
    # 8/10 == 0.80, below the 0.90 bar.
    results = [_rule("passed", rule_id=f"n{i}") for i in range(8)] + [
        _rule("failed", rule_id="n8"),
        _rule("failed", rule_id="n9"),
    ]
    passed, score, _critical = decide_brand_gate(results, pass_bar=0.90)
    assert score == 0.8
    assert passed is False


def test_should_count_not_evaluable_rule_as_failed() -> None:
    rule = {"id": "prose-1", "severity": "normal", "assertion": {"kind": "prose_tone_check"}}
    evaluated = evaluate_rule(rule, staging_dir="/does/not/matter")
    assert evaluated.status == "not_evaluable"

    # not_evaluable counts as failed-normal in the scoring decision (AC-6).
    passed, score, _critical = decide_brand_gate(
        [_rule("passed", rule_id="n0"), _rule("not_evaluable", rule_id="n1")], pass_bar=0.90
    )
    assert score == 0.5
    assert passed is False


def test_should_score_1_0_when_zero_normal_rules_and_no_critical_failures() -> None:
    results = [_rule("passed", severity="critical", rule_id="crit-1")]
    passed, score, critical_failures = decide_brand_gate(results, pass_bar=0.90)
    assert score == 1.0
    assert passed is True
    assert critical_failures == []


def test_evaluate_rule_token_scan_passes_clean_workspace(tmp_path: object) -> None:
    from pathlib import Path

    staging = Path(str(tmp_path))
    (staging / "widget.tsx").write_text("export const Widget = () => <div className='a' />;\n")
    rule = {"id": "tok-1", "severity": "critical", "assertion": {"kind": "token_scan"}}
    evaluated = evaluate_rule(rule, staging_dir=str(staging))
    assert evaluated.status == "passed"


def test_evaluate_rule_token_scan_fails_on_raw_hex_literal(tmp_path: object) -> None:
    from pathlib import Path

    staging = Path(str(tmp_path))
    (staging / "widget.css").write_text(".widget { color: #ff00aa; }\n")
    rule = {"id": "tok-1", "severity": "critical", "assertion": {"kind": "token_scan"}}
    evaluated = evaluate_rule(rule, staging_dir=str(staging))
    assert evaluated.status == "failed"
