---
type: TechSpec
title: "Graph Explorer — Spec Invariants (M1 + M2)"
description: "Flat checklist of architectural invariants the engineer MUST honour and QA MUST
  verify, each with a verify-by selector (file path + grep pattern or named test)."
tags: [graph-explorer, arch, tech-spec, invariants]
status: Draft
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/graph-explorer/tech-spec/invariants.md
source: hand-authored
confirmed_by: none
expires_on: 2027-01-08
owner: gazzwi86
coverage: graph-explorer
---

# Graph Explorer — Spec Invariants

One line per invariant. Paths are indicative until code lands; QA resolves the actual file via
the task brief that implements it, then pins the selector.

## M1 (consolidated from architecture.md §Invariants)

- Layout writes issue `SET LOCAL app.current_tenant_id` inside the transaction before any DML;
  RLS policy is fail-closed — verify-by: layout service session code +
  `grep "SET LOCAL app.current_tenant_id"`; RLS policy in Alembic migration +
  `grep "current_setting('app.current_tenant_id')"`.
- No SPARQL leaves the browser or proxy except via CE-READ-1 — verify-by: proxy source +
  `grep -L` for any store URL/credential (must be absent; only the CE base URL appears).
- No partial render on CE error/timeout: empty-state + retry, never a half graph — verify-by:
  named test `test_no_partial_render_on_ce_error`.
- No predicate IRI literal in traversal/drill-in code; closure and domain-membership predicates
  load from config — verify-by: traversal source + `grep -r "weave:"` (hits allowed only in the
  config module/fixture files).
- Renderer accessed only through the adapter interface (`load/onNodeClick/getViewport/
  setLayout/pin`) — verify-by: `grep -r "from 'cytoscape'"` outside the adapter module (must be
  empty).
- Layout position never silently dropped: optimistic hold + backoff + toast on exhaustion —
  verify-by: named test `test_layout_save_retry_never_drops`.
- Raw IRI hidden from non-ontologist side panel; cross-tenant IRI fetch renders generic
  not-found (CE returns 404) — verify-by: named tests `test_iri_hidden_non_ontologist`,
  `test_cross_tenant_iri_not_found`.
- Zero axe-core violations on non-canvas UI in CI — verify-by: CI axe job on Explorer routes.

## M2 delta

- Every canvas mutation (Explorer and embedded GE-CANVAS-1) goes through
  `POST /api/proxy/operations/apply` → CE-WRITE-1; no other write path to graph data exists —
  verify-by: SPA source + `grep -r "operations/apply"` (single client call-site in the edit
  controller); no direct RDF/triple writes anywhere.
- CE-WRITE-1 `actor` = JWT `principal_iri` claim taken server-side and used verbatim (never
  string-built from `sub`); a client-supplied `actor` body field is rejected; missing claim
  rejects the edit — verify-by: write-proxy handler + `grep principal_iri`; named tests
  `test_edit_rejected_without_principal_claim`, `test_spoofed_actor_body_rejected` (ADR-006).
- Closure config drift guard: closure predicates resolve against CE `/api/ontology/types` at
  boot; unresolvable entry ⇒ loud config error + traversal disabled — verify-by: named test
  `test_closure_drift_guard_fails_loud` (ADR-005).
- Version-pinned canvas is read-only regardless of `readonly` prop; no edit affordance renders
  on any published version — verify-by: conformance test
  `should force readonly when version is pinned` (ge-canvas-1.md rule 4).
- GE-CANVAS-1 `mode` other than `"force"` throws a descriptive mount error in M2 — verify-by:
  conformance test `should throw unsupported-mode error when mode is c4`.
- Heatmap and diff overlays are mutually exclusive; enabling one disables the other —
  verify-by: named test `test_overlay_mutual_exclusion` (FR-015/FR-016).
- Optimistic edits roll back completely on `422`/timeout: no orphan node, no phantom-removed
  element — verify-by: named tests `test_add_node_rollback_on_422`,
  `test_delete_rollback_on_failure` (FR-019/020/022).
- Concurrent same-property edit: LWW-with-version-check; second writer receives `409` + notice —
  verify-by: named test `test_concurrent_edit_409` (E5-S3).
- Saved-view name uniqueness is a DB constraint, not app code — verify-by: Alembic migration +
  `grep "UNIQUE (tenant_id, workspace_id, name)"`.
- `explorer_saved_views` and `explorer_comments` carry the same fail-closed RLS policy as the
  layout table — verify-by: Alembic migration + `grep -c "current_setting('app.current_tenant_id')"`
  ≥ 3 (one per table).
- Saved-view layout snapshots live in `explorer_layout_positions` under
  `graph_id = 'view:' || view_id`; no second positions store — verify-by: persistence service +
  `grep "view:"` in the views router; schema contains no other positions table.
  *(Pending amendment: embedded-canvas layout scope becomes `(source, filterByIri)` at Build
  v1.0 — the graph_id-only key is M2-correct, not immutable.)*
- View share excludes recipients without graph access (no cross-user leak) — verify-by: named
  test `test_share_excludes_ineligible_recipients` (E6-S1).
- Live refresh is poll-only in M2 (CE-READ-1 since-version, default 30 s, tunable) and never
  blocks interaction; no CE-EVENT-1 stream consumer exists in M2 — verify-by:
  `grep -r "api/events"` in SPA source (must be empty in M2).
- Diff/version export is JSON only in M2 — verify-by: export module + `grep -ri "pdf\|csv"`
  (must be empty) (OQ-06).
- Cross-tenant isolation release gate covers layout + views + comments + `view:*` layout rows:
  tenant-A JWT reads zero tenant-B rows; tenant-B view id addressed ⇒ reject — verify-by:
  seeded two-tenant release-gate suite `test_cross_tenant_isolation_m2`.
- No real cloud calls in any test: CE, Platform (NOTIFY/SETTINGS), and Cognito JWTs are
  stubbed/local fixtures (Law F) — verify-by: test config + `grep -r "amazonaws.com"` in test
  code (must be empty).
