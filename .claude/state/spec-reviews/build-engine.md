# Spec review — build-engine

**Date:** 2026-07-02 · **Verdict:** PASS (after fixes) · **Reviewed by:** /spec-review (full-sweep)

| # | Finding | Resolution |
|---|---|---|
| 1 | TASK-006/007 built M2 blocking behaviour the spec reconciled to M1 non-blocking stubs (BLOCKER) | Downgraded: dep-summary reads best-effort + warn; pre-scaffold review pass-through stub; M2 activation notes (FR-043/FR-055) |
| 2 | TASK-010 (repo bootstrap, FR-061) absent from tech spec (BLOCKER) | business-process.md gained #repo-bootstrap-flow (ScmDriver, run step 0); data-model.md gained repo_provider/repo_url/repo_default_branch/scm_token_secret_ref/repo_bootstrap_status |
| 3 | Dropped model Haiku in 6 sites incl. phantom mermaid participant (HIGH) | All → claude-sonnet-5; tree greps 0 |
| 4 | Safety-gate order contradiction (secret-scan last vs first) (MEDIUM) | business-process.md reordered secret-scan-first |
| 5 | weave-spec listed 4 safety gates, engine defines 5 (MEDIUM) | weave-spec corrected to 5 (adds package-existence) |
| 6 | ADR links off-by-one; adr_refs empty (MEDIUM) | Links fixed; TASK-006→ADR-001, TASK-004/005→ADR-002 |
| 7 | Lows: table count, pinned_graph_version_iri naming, FR-004/FR-008 clarification, custom:principal_iri claim, garbled prose | All fixed |
| 8 | architecture.md + testing-strategy.md missing (CRITICAL) | Both produced 2026-07-02 (dark-factory C4, 5 agent principals, model routing; delta-scoped mutation, pinned CE stubs, testcontainers-postgres) |

Gates: Brief/PRD/Roadmap/timing/dependency-graph all PASS (EARS was already clean; DAG acyclic, TASK-006's 5 blockers all M1).
