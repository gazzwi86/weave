# M2/v1 red-team findings (2026-07-08)

Adversarial spec review, 8 reviewers (one per engine-milestone). Blocker/Major captured; Minors
summarised. Every engine reviewed so far returns NOT build-ready. Remediation dispatch pending full set.

## Cross-cutting themes
- **Contract-truth gaps** (highest value): briefs assume API shapes contracts.md never defines —
  PLAT-BILLING-1 read/query surface, PLAT-AUDIT-1 `event_type` taxonomy, CE-WRITE-1 idempotency-key
  semantics, CE-READ-1 `coverage_gap` scope, `authority()`/ODRL vocabulary (OQ-AUTH-1 undecided).
- **Stale PO-source tags**: off-by-one story→task, wrong-phase epic tags (CE M2 ×4, CE v1 ×1).
- **Schema divergence**: Platform v1 connector table defined 3 incompatible ways.
- **Real design flaws + a security Blocker** (Platform v1 SSRF).

## CE M2 — NOT build-ready
- BLOCKER: TASK-010 `authority()` ships M2 but its Authority Extension / ODRL vocab is unresolved
  (OQ-AUTH-1) + untasked; AC-010-03 "explicit deny" unbuildable. PRD cites ADR-002 for this but
  ADR-002 is provenance, not ODRL — the authority-extension decision does not exist.
- MAJOR: TASK-010 verdict shape drifts from CE-READ-1 (`decision/permit` vs `verdict/allow`).
- MAJOR: TASK-008 epic tag EPIC-009 = "Phase-1/M1 provides CE-EVENT-1" contradicts M2 (beta=M2).
- MAJOR: TASK-006 `/api/validate` was M1 (E6-S3 Must) but ships M2, re-parented EPIC-006→005.
- MAJOR: TASK-007 draft_published_delta "reuse CE-DIFF-1" — but CE-DIFF-1 diffs two PUBLISHED IRIs.
- Minors ×6 (pagination drift, seq race MAX+1, epic story-number collisions, metrics orphan).

## CE v1 — NOT build-ready
- BLOCKER: TASK-006 one-proposal-per-row-group → cross-table FK edges dangle → CE-WRITE-1 422;
  relational/R2RML import (FR-041, Should) can't import related tables; circular FKs deadlock.
- MAJOR: `Access→accesses` flattened (Process→data should be consumes/produces).
- MAJOR: Serving/messageFlow `dependsOn` catch-all emits edges outside dependsOn domain (Actor) → skip.
- MAJOR: `sequenceFlow→hasStep` wrong predicate + untestable AC; BPMN ordering lost.
- MAJOR: TASK-003 XML-splitter DAG/ADR "no second parser" inconsistency (XML parse is in TASK-004).
- MAJOR: PO EPIC-012 story→task cross-refs stale (off-by-one after spine insert).
- CLEAN: runsOn direction fixes CORRECT; single-mutation-path CI real; no CE-FUNCTION-1 leak; tenancy/XXE solid.

## Platform M2 — NOT build-ready
- MAJOR: `coverage_gap` over-scoped — contract = Process missing performedBy/governedBy; briefs bind
  it to capabilities/domains/per-kind. Not derivable.
- MAJOR: PLAT-BILLING-1 has NO read/query surface, but S3/FR-034/E8-S1 need spend-read.
- MAJOR: TASK-016 S10 ops-health from PLAT-AUDIT-1 `event_type` taxonomy that's undefined.
- MAJOR: TASK-011 source-not-ga vs TASK-012 unsatisfiable conflated; keyword-precheck fragile.
- MAJOR: **tenant-vs-workspace RLS gap** — widget/library isolation claimed DB-enforced but workspace
  boundary is app-layer only, no RLS backstop; cross-workspace leak uncaught. tenant↔workspace
  cardinality never pinned.
- MAJOR: E2-S9 (CE-EVENT-1 recent-edits, M2-eligible) has NO brief.
- Minors ×12 (state-name drift, PATCH contract disagreement, is_ga signature, etc.).

## Platform v1 — NOT build-ready
- BLOCKER: connector table defined 3 incompatible ways (M1 data-model `connector_health` +
  lifecycle_state vs v1-delta folded columns vs TASK-006). Status enums differ 3 ways.
- BLOCKER: sync_direction / sync_frequency / next_sync_at / handle never captured by any config task,
  yet poller + ADR-017 allowlist depend on them.
- BLOCKER: TASK-018 ingestion idempotency key includes sync_run_id → ZERO crash-recovery; AC-6 false.
- MAJOR: **SSRF** — tenant-supplied connector host/URL unvalidated; can point at 169.254.169.254
  metadata / internal services. SECURITY.
- MAJOR: CE-WRITE-1 idempotency behaviour undefined (contract) yet ingestion relies on it.
- MAJOR: TASK-019 write-back idempotency key blocks the re-issue-after-drift path it should allow.
- MAJOR: TASK-006 AC-3 inline-probe vs v1-delta §5 stored-row read — contradictory health model.
- MAJOR: OAuth authorization-code flow (business-process Flow 6) designed but no task implements it.
- MAJOR: draft-vs-published dedup scope unspecified (re-sync may re-mint until publish; who publishes?).
- MAJOR: poller has no lifecycle/authorized/health gate (runs syncs for unauthorized/offline connectors).
- MAJOR: TASK-021 Snowflake/Databricks hard-depends on TASK-019 fixture server, labelled soft.
- CLEAN: externalId instance-scoping correct + consistent everywhere.
- Minors ×5 (colon-in-handle parse, unlocks graph, secret_arn vs secret_path, Slack scopes).

## Onboarding M2 — NOT build-ready
- BLOCKER: single `phase:"m2"` flag can't give both "config merges independently" AND "drift
  impossible" — during independent-merge window a dropped anchor is indistinguishable from
  not-yet-shipped; audit green, overlay silently no-ops. Needs per-surface "shipped" signal.
- BLOCKER: competency flag rests on a CE FR-037 named COUNT query CE-010 doesn't ship (CE ships the
  framework question SET, not a count of tenant domain questions; no query id/shape; "declared domain
  competency question" not modelled as a countable individual).
- MAJOR: Must-Have TASK-003 depends entirely on Should-Have CE TASK-010; fail-quiet hides the hole.
- MAJOR: 3 "control" anchors (ge.versions.diff-toggle, ge.overlay.completeness-toggle, ce.rules.run-report)
  their owning task never ships as discrete DOM elements.
- MAJOR: TASK-002 deep-link needs GE-008 overlay-on URL param; GE-008 has no URL state.
- MAJOR: TASK-005 tile-flip gate owned by Platform E1-S6, not the TASK-017 it names.
- Minors ×4 (double-planted anchor, CE-METRICS-1 mis-attribution, a11y focus-trap gap).

## Build M2 — NOT build-ready
- BLOCKER: TASK-005 breaking-ack cites CE-DIFF-1 `.versions[]`/per-version `breaking` — don't exist
  (CE-DIFF-1 = flat {added,removed,modified}). Need CE-VERSION-1 (ordered) + CE-FUNCTION-1 breaking
  flag. Contradicts own ADR-006 §5. Breaking-ack unbuildable as written.
- BLOCKER→MAJOR: guard only detects FUNCTION-signature breaks, not SHACL-SHAPE breaks → SDK
  regenerates silently on a shape change (defeats the "never silently breaks" guarantee).
- MAJOR: exit-criterion-2 "generated AND published (npm/pip)" contradicts ADR-006 "no publish,
  portable source" + TASK-004/005. Not mechanically verifiable.
- MAJOR: `NotExecutableUntilV1` naming wrong — execution is now POST-V1 (my 2026-07-08 ruling), but
  the name + "execution is v1.0" prose persist in ADR-006, m2-delta §5, TASK-004/005, invariants.
  Rename → `NotExecutableUntilPostV1`, fix the prose. (Direct fallout of the deferral ruling.)
- MAJOR: SHACL mapping table missing the MOST COMMON shape (required single-valued minCount1+maxCount1)
  → hits "anything else ⇒ generation fails"; missing xsd:decimal/date/anyURI/double, sh:in/class/pattern.
- MAJOR: migration ownership/DAG — TASK-005 needs TASK-001's `projects` columns but not blocked_by it;
  both claim the §4 migration → Alembic collision.
- Minors: `realise` British-s hand-copy falls through to weight 0.1; predicate-class under-weights
  hasStep/performedBy/consumes/produces; hardcoded model bypasses FR-045 routing; stale gate-kind enum.
- CLEAN: exit-crit 1/3/4 verifiable; all 17 FRs have briefs; DAG acyclic; no-self-approval; investigator
  no-sub-spawn; preflight references-not-values; GE-CANVAS-1 correctly unimported.

## GE M2 — NOT build-ready
- BLOCKER: concurrency reframe HALF-APPLIED — invariants.md + m2-delta §7 still assert the CE-409
  model that TASK-005 + contracts.md deny. TASK-011 release gate hunts a `test_concurrent_edit_409`
  no task produces + demands a 409 a compliant CE stub can't return → exit gate unpassable.
  **(Coordinator fallout: my CE-WRITE-1 reframe wasn't propagated to GE invariants/delta.)**
- MAJOR: "poll CE-READ-1 since-version" — no CE-READ-1 endpoint has a since-version filter or draft-head
  token; CE-EVENT-1 banned in M2. FR-025 poll unimplementable. Same unbacked assumption program-wide.
- MAJOR: hasField in ADR-005 closure + data-model but ABSENT from contracts.md CE-READ-1 relationship
  list (which lists skos:narrower instead) → TASK-009 drift guard would disable ALL traversal.
  Reconcile contracts.md ↔ data-model.
- MAJOR: ge-canvas-1.md filterByIri slice semantics not pinned in the LOCKED contract → two builds
  return different slices, both pass conformance.
- Minors: delete inbound-edge coverage unpinned; FR-021 reframe has no ADR; FR-022 stale; node-kinds
  route drift; readonly:true no conformance test; M1 traversal AC may have shipped unverified.
- CLEAN: DAG acyclic, full FR coverage, tenancy/attribution/spoof-guard solid, OQ-09 orientation correct.

## Build v1 — NOT build-ready
- MAJOR: TASK-007 breaking-span — no CE-DIFF-1 source (same phantom-field as Build M2). Pin additive
  CE-DIFF-1 breaking span or descope.
- MAJOR: TASK-009 8-state captures manifest has NO producer in M1/M2 → Tests tab permanently hollow.
- MAJOR: TASK-002 workspace-role overlay cited to PLAT-IDENTITY-1 (no workspace-role claim). Role
  source unpinned. SECURITY (gates every mutation).
- MAJOR: TASK-012 prompt→brief synthesis under-scoped (FR-046 DoR needs a typed brief; raw prompt
  gives none) — real new PLAN behaviour, not "context-source branch."
- MAJOR: TASK-004 forecast formula specified 3 incompatible ways (ADR-008 vs pseudocode vs AC).
- MAJOR: E2-S6 source-control provider config UI has NO v1 task (coverage gap or undocumented defer).
- **RESOLVED pre-triage** (my contract edits landed after this review): TASK-013 instance-enumeration
  + TASK-011 audit text-search — both now pinned in contracts.md.
- Minors: pinned_graph_version_iri naming, phantom TASK-014 ref, Lighthouse omission on 012/013.
- CLEAN: FR-032 correctly excluded + invariant greppable; DAG acyclic symmetric; no CE-FUNCTION-1 use;
  Role Guard 403-not-500; secrets value-free; no ungoverned create window.

## Consolidated root causes
A. CONTRACT-TRUTH GAPS (dominant): briefs assume shapes contracts.md lacks — CE-DIFF-1 breaking-span
   (Build M2/v1 + CE M2 draft-delta), PLAT-BILLING-1 read surface, PLAT-AUDIT-1 event_type taxonomy,
   CE-READ-1 since-version poll (GE), CE-WRITE-1 idempotency semantics (Plat v1), coverage_gap scope,
   authority()/ODRL (CE M2), hasField-in-/types (GE), workspace-role claim (Build v1).
B. COORDINATOR-RULING FALLOUT (mine to fix): CE-WRITE-1 reframe not propagated to GE invariants/§7
   (GE Blocker); NotExecutableUntilV1 rename after execution→post-v1 (Build M2, cross-file).
C. STALE PO-SOURCE TAGS: off-by-one story→task, wrong-phase epics (CE M2 ×4, CE v1, Plat counts).
D. REAL DESIGN/SECURITY FLAWS: Plat-v1 SSRF; Plat-M2 tenant↔workspace RLS gap; Plat-v1 idempotency
   inert + connector-table-3-ways + OAuth-untasked; CE-v1 per-row FK dangling; Build forecast-3-ways.

## REMEDIATION PLAN (2026-07-08)

### Human scope decisions (locked)
- CE M2 authority() → DESCOPE to base-links (deny-default + coverage-gap) for M2; ADD a POST-V1
  item for the full Authority Extension (ODRL vocab). Fix ADR-002 mis-citation; OQ-AUTH-1 = deferred.
- CE v1 relational (FR-041) → FIX the per-row FK decomposition (batch related rows in one CE-WRITE-1).
- DROP "workspace" ENTIRELY → 3-level cascade Company→Domain→Project + super-admin; workspace-scoped
  state re-homes TENANT-scoped. Footprint: 1072 mentions/126 spec files + 669 M1 code files.
  Mechanism: each engine architect re-homes its OWN workspace refs during remediation; coordinator
  handles program-level docs (contracts.md, weave-spec.md, tenancy, personas, dev-environment);
  M1 CODE refactor = tracked follow-up (M1 can't rebuild until its gate is green).
- Platform v1 OAuth → ADD an OAuth-authcode task (redirect→callback→refresh; configured→authorized).

### Phase 1 — coordinator + Fable (unblocks briefs)
Contract-surface authoring in contracts.md (Fable-consulted): CE-DIFF-1 breaking-span (+ SHACL-shape
break detection), PLAT-BILLING-1 read surface, PLAT-AUDIT-1 event_type taxonomy, CE-READ-1
since-version poll, CE-WRITE-1 idempotency semantics, coverage_gap scope, hasField reconcile.
Coordinator-ruling fallout: GE invariants/§7 purge CE-409; NotExecutableUntilV1→NotExecutableUntilPostV1.
Program-level workspace purge (contracts/weave-spec/tenancy/personas/dev-env).

### Phase 2 — per-engine architect re-dispatch (each gets its findings + settled contracts)
CE M2, CE v1, Platform M2, Platform v1, GE M2, Build M2, Build v1, Onboarding M2. Each: fix red-team
Blockers/Majors, re-home workspace→tenant, fix stale PO tags.

### Phase 3 — re-verify (spot red-team / council) → then progress.json seed → anatomy → commit → push.
