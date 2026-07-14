---
type: TechSpec
title: "Graph Explorer — Spec Invariants (M1 + M2)"
description: "Flat checklist of architectural invariants the engineer MUST honour and QA MUST
  verify, each with a verify-by selector (file path + grep pattern or named test)."
tags: [graph-explorer, arch, tech-spec, invariants]
status: Draft
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/tech-spec/invariants-explorer.md
source: hand-authored
confirmed_by: none
expires_on: 2027-01-08
owner: gazzwi86
coverage: constitution-engine
---

# Graph Explorer — Spec Invariants

One line per invariant. Selectors below are pinned to real repo paths (CE-V1-TASK-030 AC-5) —
a path in backticks is an exact, greppable file; a `test_*` token is checked for definition
presence across `packages/backend/tests/` and `packages/frontend/**/__tests__|tests`.

## M1 (consolidated from architecture-explorer.md §Invariants)

- Layout writes scope the RLS session GUC inside the transaction before any DML; RLS policy is
  fail-closed — verify-by: `packages/backend/src/weave_backend/explorer/persistence.py` +
  `packages/backend/src/weave_backend/routers/layout.py` +
  `grep "set_config('app.current_tenant_id'"`; RLS policy in
  `packages/backend/migrations/0008_explorer_layout_positions.sql` +
  `grep "current_setting('app.current_tenant_id')"`.
- No SPARQL leaves the browser or proxy except via CE-READ-1 — verify-by:
  `packages/frontend/app/api/proxy/sparql/route.ts` +
  `grep -riE "oxigraph|neptune|fuseki|:[^/[:space:]]*@"` (must be empty; only the backend base
  URL, `BACKEND_API_URL`, appears — no direct store hostname or embedded credential).
- No partial render on CE error/timeout: empty-state + retry, never a half graph — verify-by:
  named test `test_no_partial_render_on_ce_error`.
- No predicate IRI literal in traversal/drill-in code; closure and domain-membership predicates
  load from config — verify-by: `packages/frontend/lib/explorer/traversal-walk.ts` +
  `packages/frontend/lib/explorer/closure-config.ts` + `grep -r "weave:"` (must be empty — both
  files build predicate IRIs from a `WEAVE_ONTOLOGY_NS` namespace constant, never the literal
  string).
- Renderer accessed only through the adapter interface (`load/onNodeClick/getViewport/
  setLayout/pin`) — verify-by: `grep -r "from 'cytoscape'"` outside
  `packages/frontend/lib/explorer/renderer-adapter.ts` (must be empty).
- Layout position never silently dropped: optimistic hold + backoff + toast on exhaustion —
  verify-by: named test `test_layout_save_retry_never_drops`.
- Raw IRI hidden from non-ontologist side panel; cross-tenant IRI fetch renders generic
  not-found (CE returns 404) — verify-by: named tests `test_iri_hidden_non_ontologist`,
  `test_cross_tenant_iri_not_found`.
- Zero axe-core violations on non-canvas UI in CI — verify-by: CI `axe-m2` job on Explorer
  routes (`.github/workflows/ci.yml`).

## M2 delta

- Every canvas mutation (Explorer and embedded GE-CANVAS-1) goes through
  `POST /api/proxy/operations/apply` → CE-WRITE-1; no other write path to graph data exists —
  verify-by: `packages/frontend/lib/explorer/edit-controller.ts` +
  `grep -r "operations/apply"` (single client call-site in the edit controller); no direct
  RDF/triple writes anywhere.
- CE-WRITE-1 `actor` = JWT `principal_iri` claim taken server-side and used verbatim (never
  string-built from `sub`); a client-supplied `actor` body field is rejected; missing claim
  rejects the edit — verify-by: `packages/backend/src/weave_backend/routers/operations.py` +
  `grep principal_iri`; named tests `test_edit_rejected_without_principal_claim`,
  `test_spoofed_actor_body_rejected` (ADR-019).
- Closure config drift guard: closure predicates resolve against CE `/api/ontology/types` at
  boot; unresolvable entry ⇒ loud config error + traversal disabled — verify-by: named test
  `test_closure_drift_guard_fails_loud` (ADR-018).
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
- Concurrent same-property edit: GE-side since-version drift guard — save against a moved draft
  head is blocked with a conflict notice + current server values; no-drift concurrent edits are
  LWW (both commit as successive CE versions). CE-WRITE-1 M2 has NO conditional write / `409`;
  no test may demand one from a CE stub (ADR-021) — verify-by: named tests
  `test_drift_guard_blocks_save_and_shows_current`, `test_lww_when_no_drift_detected` (E5-S3).
- Saved-view name uniqueness is a DB constraint, not app code — verify-by:
  `packages/backend/migrations/0063_explorer_saved_views.sql` +
  `grep "UNIQUE (tenant_id, name)"`.
- `explorer_saved_views` and `explorer_comments` carry the same fail-closed RLS policy as the
  layout table — verify-by: `packages/backend/migrations/0063_explorer_saved_views.sql` +
  `packages/backend/migrations/0064_explorer_comments.sql` +
  `packages/backend/migrations/0008_explorer_layout_positions.sql` +
  `grep -c "current_setting('app.current_tenant_id'"` ≥ 1 in each of the three files (0008's
  variant has a `::uuid` cast, 0063/0064's has a `missing_ok=true` second arg -- the prefix up
  to the tenant-id literal is what's shared and load-bearing).
- Saved-view layout snapshots live in `explorer_layout_positions` under
  `graph_id = 'view:' || view_id`; no second positions store — verify-by:
  `packages/backend/src/weave_backend/explorer/persistence.py` +
  `packages/backend/src/weave_backend/routers/views.py` + `grep "view:"` in the views router;
  schema contains no other positions table.
  *(Pending amendment: embedded-canvas layout scope becomes `(source, filterByIri)` at Build
  v1.0 — the graph_id-only key is M2-correct, not immutable.)*
- View share excludes recipients without graph access (no cross-user leak) — verify-by: named
  test `test_share_view_publishes_and_excludes_ineligible_recipient` (E6-S1).
- Live refresh polls the CE-EVENT-1 beta seq feed (`GET /api/events?since_seq={n}` via the GE
  proxy, default 30 s, tunable) — draft commits arrive as `version_iri: null` rows; a `410 Gone`
  cursor re-baselines via CE-READ-1, never a silent empty page; polling never blocks interaction.
  No push/WebSocket consumer exists in M2 (post-v1 upgrade) — verify-by:
  `packages/frontend/components/explorer/use-event-poll.ts` + `grep "since_seq"`;
  `grep -ri "websocket\|EventSource"` in that same file (must be empty).
- Diff/version export is JSON only in M2 — verify-by:
  `packages/frontend/lib/explorer/diff/build-diff-export.ts` + `grep -ri "pdf\|csv"`
  (must be empty) (OQ-06).
- Cross-tenant isolation release gate covers layout + views + comments + `view:*` layout rows:
  tenant-A JWT reads zero tenant-B rows; tenant-B view id addressed ⇒ reject — verify-by:
  seeded two-tenant release-gate suite `test_cross_tenant_isolation_m2`.
- No real cloud calls in any test: CE, Platform (NOTIFY/SETTINGS), and Cognito JWTs are
  stubbed/local fixtures (Law F) — verify-by: test config + `grep -r "amazonaws.com"` in test
  code (must be empty).
