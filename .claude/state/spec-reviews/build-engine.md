# Spec review — build-engine

## 2026-07-09 · v1 milestone · Verdict: READY (zero critical)

Re-reviewed for phase `build-engine-v1/phase-1` because v1 specs changed after the prior marker
(mock-v5 + voice/speech purge, 2026-07-08/09). All 24 v1 task briefs checked: EARS-clean ACs,
AC-to-test mappings present, self-contained, DoR-satisfiable, contract IDs resolve, blocked_by
chains resolve. Focus set (EPIC-002: TASK-001, 010–014) airtight.

**Warnings (non-blocking, logged):**

1. **M2/v1.0 consolidation (governance).** TASK-001–009 bodies self-tag as M2 work (E2-S7, roadmap
   M2 Exit Criteria FR-063/FR-064) but live in `v1/tasks/` with no `m2/` folder or sub-phase gate.
   Buildable as-is; M2 exit criteria lack a gate boundary. **Human decision** — retag+split or
   document the consolidation. Above generation-tier authority; does not block build.
2. **milestone string split:** TASK-001–009 `milestone: v1`, TASK-010–024 `milestone: v1.0`, same
   folder. No tooling keys off it today — flagged to prevent rot.
3. **adr_refs: []** on TASK-014 (cites ADR-009), 015 (ADR-009), 016 (ADR-001), 020 (ADR-002) —
   mechanical frontmatter fix; none blocks current ready-set.

---

## 2026-07-02 · m1 milestone · Verdict: PASS (after fixes) — historical

| # | Finding | Resolution |
|---|---|---|
| 1 | TASK-006/007 built M2 blocking behaviour the spec reconciled to M1 non-blocking stubs (BLOCKER) | Downgraded: dep-summary reads best-effort + warn; pre-scaffold review pass-through stub; M2 activation notes (FR-043/FR-055) |
| 2 | TASK-010 (repo bootstrap, FR-061) absent from tech spec (BLOCKER) | business-process.md gained #repo-bootstrap-flow (ScmDriver, run step 0); data-model.md gained repo_provider/repo_url/repo_default_branch/scm_token_secret_ref/repo_bootstrap_status |
| 3 | Dropped model Haiku in 6 sites incl. phantom mermaid participant (HIGH) | All → claude-sonnet-5; tree greps 0 |
| 4 | Safety-gate order contradiction (secret-scan last vs first) (MEDIUM) | business-process.md reordered secret-scan-first |
| 5 | weave-spec listed 4 safety gates, engine defines 5 (MEDIUM) | weave-spec corrected to 5 (adds package-existence) |
| 6 | ADR links off-by-one; adr_refs empty (MEDIUM) | Links fixed; TASK-006→ADR-001, TASK-004/005→ADR-002 |
| 7 | Lows: table count, pinned_graph_version_iri naming, FR-004/FR-008 clarification, custom:principal_iri claim, garbled prose | All fixed |
| 8 | architecture.md + testing-strategy.md missing (CRITICAL) | Both produced 2026-07-02 |
