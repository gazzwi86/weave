# Progress: CE-V1-TASK-006 — Rules & Policies Screen + GET /api/validate full report (EPIC-005, LAST task → closes epic)

`constitution-engine` EPIC-005. Worktree `../weave-CE-V1-EPIC-005`, branch `feature/CE-V1-EPIC-005` (off origin/main, behind
by merged CE-008/009 pipeline changes → union pipeline.py at epic-close). Full-stack. Built across groundwork + 4 continuations.
Coordinator-authored pre-QA. HEAD `d88332a`, not pushed, tree clean, docker torn down. EPIC-005's last task (CE-005+CE-007 done).

## What shipped (7 ACs, all Done per engineer, E2E ran green)
- **`GET /api/validate`** (`routers/validate.py`, mounted) — full tenant-scoped SHACL report. Type split
  `ValidationPending` vs `ValidationReport` (honest pending, never fake 0). `validate_report.py` + `validate_cache.py` (mirror
  metrics_cache), keyed by `head_version_iri()` draft stamp; explicit `run=true` for the heavy path. **Perf bug fixed**
  (`cf29b68`): build_report double-fetched the merged shapes graph → deduped to one fetch.
- **Rules & Policies screen** (`app/ce/rules/page.tsx` + `use-rules.ts` + proxy `/api/proxy/validate`) — MOUNTED via
  nav-items `/ce/rules`. Rule catalogue incl. zero-violation shapes, severity (incl sh:Info), per-rule violation count,
  violating-entity links to `/explorer?focus=<iri>`.

## Per-AC (engineer-reported — QA re-verify; 7 ACs)
AC-006-01 endpoint (4570f94) · AC-006-02 framework+tenant merge+cache (4570f94/cf29b68) · AC-006-03 rule catalogue incl
zero-violation (73732d8) · AC-006-04 honest pending vs cached (type split) · AC-006-05 violating-entity→resource link
(73732d8 rule-row.tsx, E2E-proven) · AC-006-06 perf (see below) · AC-006-07 **E2E RAN GREEN** (4244759 — 2 Playwright specs
vs live docker: pending→real POST /api/operations/apply→Run validation→rule list w/ severity/count→violating link→axe zero).

## Perf (AC-006-06) — justified 10k ceiling (ADR-026)
Measured at true 100k-triple draft: `GET /api/validate?run=true` ~2.3s (fetch 0.2 + rdflib parse 0.9 + pyshacl validate 1.2)
vs 2.0s budget — OVER, dominated by pyshacl's own cost, NOT an app bug. Mirrors ADR-004's approved write-path finding (100k
crashes / 10k = real M1 gating scale) → **ADR-026-validate-read-path-perf-ceiling** retargets the read-path perf test to 10k
with explicit numbers. **QA: confirm this justification is sound** (pyshacl-bound, not a fixable app hotspot) + that pending/
cache path stays sub-budget.

## ⚠️ ADR-026 (renumbered from 025 — collision) + severity clarification
- Engineer originally wrote ADR-025; collided with merged ADR-025-explorer (CE-025) → renumbered to **ADR-026** (`d88332a`),
  citation in test_validate_api.py updated. (Pre-existing 2× ADR-022 duplicate mess untouched — PROJ-006 phase-gate sweep.)
- `RuleCoverage.severity` = HIGHEST severity across a shape's properties (e.g. ActivityShape shows "Violation" though only its
  description property is Warning) — confirmed intentional via `shacl.py::_rule_severity` docstring; E2E asserts this real
  behaviour. QA confirm not a defect.

## ⚠️ QA FOCUS
Tenant-scoping (JWT principal only, no client tenant) on /api/validate; screen MOUNTED+reachable (grep nav→route→component);
honest pending (never fake 0 violations); shared pipeline.py/shacl.py regression (full unit suite); perf-10k justification;
severity=highest clarification.

## Gates
ruff 0 · mypy 0 · tsc 0 · validate unit + integration green (real docker, torn down) · E2E 2/2 real. No migration.

## Commits (feature/CE-V1-EPIC-005, not pushed): 97a279c (head_version_iri) · 59de3d0 (schemas) · 95cdb26 (report+cache) · 4570f94 (endpoint+mount) · cf29b68 (perf dedupe) · 344bc9b (integration) · 73732d8 (frontend screen) · 4244759 (E2E) · d88332a (ADR-026 renumber, HEAD).

## Epic status — EPIC-005 CLOSES on QA-pass → auto-merge eligible (no migration)
CE-006 last task. On QA PASS: reconcile onto green main — **union pipeline.py (XT-WRITEPATH-2)**: branch has CE-005's
tenant-SHACL hook; main now has CE-008 change-event + CE-009 immutability-gate (both merged) → union all three in _apply_uncached.
Also carries CE-005/007 ADRs (022-metrics/023/024) — leave numbering to PROJ-006 sweep unless a hard file collision. Then push,
PR, review, CI → auto-merge (non-risky). Run ui_verify on /ce/rules before close (UI-gate).
