# M2/v1 spec build — coordinator decision log

Session-scoped breadcrumbs for the parallel-architect M2/v1 decomposition (2026-07-08). Delegate
mode: coordinator auto-approves intra-engine brief content; escalates contracts.md canonical-text
changes and PO-artifact contradictions. Fable advisor consulted on consequential forks.

## Unilateral rulings (breadcrumbs)

- **S3 widget scope** → INCLUDE E2-S3 token/AI-spend in Platform TASK-016. Epic says "Must — token
  MVP" (weave-platform.md:993-998,1090); roadmap story list omitted it = transcription miss, not a
  PO fork. Fable APPROVE. Follow-up: PO erratum to patch the roadmap story list.
- **Task numbering** → RESTART at TASK-001 per milestone dir (CE M2, GE M2, Build M2). Platform M2
  continued at TASK-010 (outlier, left as-is). Milestone dir + engine prefix disambiguate.
- **OQ closes:** GE OQ-06 JSON-only M2; Build OQ-10 VoiceRules (CE-BRAND-1 defines shape), OQ-05
  cost-attribution deferred v1.0, OQ-08 deferred; CE OQ-14 (OCEL via RML), OQ-17 (materialised-copy
  not federation).
- **CE-FUNCTION-1 typing** = D (RDF + derived JSON-Schema projection); versioning with graph;
  immutable signatures + fail-closed breaking taxonomy. (ADR-009, user-elicited.)
- **CE-EVENT-1 transport** = change-feed (Aurora append-only, same-txn). (ADR-008.)
- **OQ-09 GE closure** = 13 directed predicates (user-elicited, 2 rounds, all recommended).
- **Platform OQ-02/03/10** = SSE-on-Python-API / SWR / Aurora widget store (ADR-012/013/014).
- **CE v1 ADR-011** = Titan v2 + structure-aware chunking, per-index model metadata, per-format
  splitters + fixed-window fallback, no ML parsing. (Fable-approved.)

## Contracts.md deltas applied (serial, by coordinator)

1. CE-EVENT-1 change-feed transport + draft-event `version_iri:null`+last_published.
2. CE-FUNCTION-1 full typing model + status/breaking + M2/v1 split + breaking-baseline sentence.
3. CE-BRAND-1 closed-core + extensions token shape.
4. CE-METRICS-1 `{pending:true}` shape (consumers render pending, never zeros).
5. PLAT-IDENTITY-1 retitled "Principal registry (human + agent)" — documents M1 human-IRI minting
   in JWT `principal_iri` claim.
6. GE-CANVAS-1 M2-pin pointer (force-mode only; detail in ge-canvas-1.md).
7. CE-READ-1 additive `citations` array on `POST /api/query/nl` (CE v1 ADR-011; entity_iri +
   artefact_iri + passage_id + locator + ≤300-char snippet). User-facing; surfaced to human.
8. CE-WRITE-1 referential-integrity statement (no server cascade; SHACL-422 on dangling refs;
   deleting client submits incident-edge deletes, reading out-of-slice edges first). [Fable]
9. CE-WRITE-1 **planned additive v1** `expected_version` → `409 {current_version_iri}` for
   server-side lost-update protection (GE/Events design toward; M2 ships client-side warn-on-drift).
   [Fable — silent-lost-update gap in multi-user editing]

## Fable advisor catches (banked)

- ArchiMate→BPMO mapping: flat Serving→dependsOn conflicts with BPMO provenance (Serving IS
  runsOn's source). Fix relayed to CE v1: split Serving (System→Service = runsOn; else dependsOn) +
  verify Realization component→service direction. Pre-ship fix (poisons imports otherwise).
- Multi-user lost-update: client-side drift warning ≠ protection → planned v1 expected_version (delta 9).
- JWT `principal_iri` claim is now cross-engine surface → needs a conformance test (follow-up).

## Open follow-ups (action at wrap)

- [ ] Seed progress.json M2 phases (CE, Platform, GE, Build) + v1 phases; register task IDs backlog.
- [ ] End-of-run commit pass, engine-isolated: Platform M2, GE M2, CE v1, Build M2 artifacts + the
      6 contracts.md deltas. **Pre-commit: diff each stream's cited contract IDs vs final
      contracts.md** (Fable mitigation — Build read contracts at spawn, before later serial edits).
- [ ] Conformance test asserting JWT `principal_iri` claim exists (Cognito config change must not
      silently break GE attribution). Owner: Platform contract test / GE TASK-004 defensive AC.
- [ ] Confirm GE freezes ge-canvas-1.md prop surface (stability lock is nominal otherwise).
- [ ] Log elicit-skill SKILL.md broken `00-elicit` path template (stray `.md`) to QA ledger (harness
      bug — governance follow-up, not inline fix).
- [ ] GE duplicate ADR-004 filename cleanup (two ADR-004 files).
- [ ] Disambiguate FR-043 "ADR-003" → program-level `docs/specs/weave/decisions/ADR-003-document-corpus.md`.
- [ ] CE-METRICS-1 relationship-count field for E2-S13 growth chart (decide-later, PO/CE).
- [ ] GE-CANVAS-1 layout-scope amendment `(source, filterByIri)` when Build v1.0 embeds (noted in GE file).
- [ ] PO roadmap S3 erratum (story list text still says 9).
- [ ] stop.py docstring change — user bundling in their own commit (harness path, left uncommitted).

## Cross-engine reconciliations resolved

- Human-principal IRI: NOT a gap — M1 PLAT-TASK-004 mints it in the JWT claim. Doc fixed.
- Build M2 ≠ GE-CANVAS-1 consumer (that's Build v1.0 FR-032, post-v1). Build M2 = Legibility+Trust.
