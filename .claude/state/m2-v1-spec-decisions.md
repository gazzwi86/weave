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
- ADR-015 externalId: type-scoped would collide (two Jira sites → merged graph nodes). Fixed to
  instance-handle-scoped, no tenant_id in value. Skip-unknown-kind kept as warning + counted-degraded.

## v1 streams (2026-07-08, second wave)

- Contract delta 10: **PLAT-CONNECTOR-1** ingestion identity + idempotency + skipped-count health +
  write-back allowlist (Atlassian/ServiceNow, reject-on-drift). [ADR-015/017, Fable-corrected]
- **FR-032 (project-ontology embed) = POST-V1** (human ruling) — follows committed roadmap; dropped
  from Build v1 (ADR-009 + embed tasks cut); GE-CANVAS-1 layout-scope amendment deferred to post-v1.
- Build v1 ADR-008 cost attribution (local cost_events rollup + additive PLAT-BILLING-1 task_id tags).
- Platform v1 ADR-016 (DB due-poller, no EventBridge), ADR-017 (write-back allowlist).
- CE-FUNCTION-1 execution OUT of Build v1 (no v1 FR consumes it; NotExecutableUntilV1 stands).
- Onboarding M2 = 3 overlays + competency flag; anchor placement self-enforced by M1 CI audit.
- New follow-up: M1 delivery-spec / env-schema backfill (Build M2 Law-9 gap, recorded not fixed).
- **CE-FUNCTION-1 execution = POST-V1** (human ruling 2026-07-08). No v1.0 consumer (Build v1 doesn't
  invoke; Events & Actions is post-v1) → shipping a runtime at v1.0 is speculative. CE v1.0 = ingest
  (EPIC-012) only. Contract delta 11 applied (contracts.md CE-FUNCTION-1 milestone split). PO erratum:
  reconcile the "v1.0 (full)" tag in constitution-engine.md (~L561, L1456, L1119) → "post-v1 (execution)".
- Contract delta 11: CE-FUNCTION-1 execution deferred M2/v1.0 → M2-definition / post-v1-execution.
- CE-WRITE-1 idempotency-key contract test = v1 dependency (Platform TASK-018 AC-6 relies on it).

## Open follow-ups (action at wrap)

- [ ] Seed progress.json M2 phases (CE, Platform, GE, Build) + v1 phases; register task IDs backlog.
- [ ] End-of-run commit pass, engine-isolated: Platform M2, GE M2, CE v1, Build M2 artifacts + the
      6 contracts.md deltas. **Pre-commit: diff each stream's cited contract IDs vs final
      contracts.md** (Fable mitigation — Build read contracts at spawn, before later serial edits).
- [ ] Conformance test asserting JWT `principal_iri` claim exists (Cognito config change must not
      silently break GE attribution). Owner: Platform contract test / CE v1 TASK-023 (ex-GE v1
      TASK-004) defensive AC.
- [ ] Confirm GE freezes ge-canvas-1.md prop surface (stability lock is nominal otherwise).
- [ ] Log elicit-skill SKILL.md broken `00-elicit` path template (stray `.md`) to QA ledger (harness
      bug — governance follow-up, not inline fix).
- [ ] GE duplicate ADR-004 filename cleanup (two ADR-004 files).
- [ ] Disambiguate FR-043 "ADR-003" → program-level `docs/specs/weave/decisions/ADR-003-document-corpus.md`.
- [ ] CE-METRICS-1 relationship-count field for E2-S13 growth chart (decide-later, PO/CE).
- [ ] GE-CANVAS-1 layout-scope amendment `(source, filterByIri)` when Build v1.0 embeds (noted in GE file).
- [ ] PO roadmap S3 erratum (story list text still says 9).
- [ ] stop.py docstring change — user bundling in their own commit (harness path, left uncommitted).
- [ ] CE ESCALATION E1/E2 (from Onboarding): FR-037 competency-declaration has NO CE carrier.
      Onboarding ships MANUAL self-mark now (post-v1 auto-clear). CE needs EITHER (a) model declared
      CQs as countable + named count query over CE-READ-1, OR (b) amend CE M2 TASK-010 AC-010-07 +
      constitution-engine.md ~L1497 to drop the onboarding-flag clause. DEFAULT RULING = (b) defer
      auto-competency to post-v1 (mirrors authority descope). Send to CE agent as follow-up. E2 (no
      client CQ-declaration surface) → post-v1 CE gap; Onboarding interim = training article.
- [ ] PRODUCT FORK (GE, defaulted tenant-shared): former "workspace-shared" saved-view library
      re-homed to TENANT-shared (workspace ≡ company). If PO wants PROJECT-scoped saved views
      instead → 1 DDL column + AC tweak. Surface to user for decision.
- [ ] personas.md authority tags stale post-descope: L175/178 cite "Authority Extension (ADR-002,
      M2)" + "M1→M2 ODRL" — now full Authority Extension = post-v1 + ADR-002 is provenance not ODRL.
      Not in program-purge scope (that agent = workspace only). Patch at wrap review to `[post-v1]`.

## Phase 1 remediation — contracts.md deltas (2026-07-08, Fable-consulted, DONE)

Fable delivered a full contract-batch resolution + addendum. Applied serially by coordinator (sole
contracts.md writer). All authored:

- **CE-READ-1 coverage_gap** broadened `coverage_gap(kind, required_links[])`, default
  `(Process,[performedBy,governedBy])`, row shape unchanged. (Platform briefs narrow TO this, not the reverse.)
- **CE-READ-1 hasField** added to relationship list + list annotated "illustrative — /api/ontology/types
  authoritative" (fixes GE Blocker + ontology-standards no-hand-copied-list rule).
- **CE-WRITE-1 idempotency** PINNED: per-tenant key, 24h tunable window, replay→original 201, diff-payload→409.
- **CE-DIFF-1 breaking-span** additive `versions:[{version_iri,breaking}]` (ordered) + shape-break
  detection lives in CE at publish (function-sig AND shape/kind); Build reads flag, never parses SHACL.
- **CE-EVENT-1** stale consumer note fixed → seq feed IS the polled transport; NO "CE-READ-1
  since-version" fallback (that filter never existed — GE Blocker root cause).
- **PLAT-AUDIT-1** event_type = dotted `{engine}.{noun}.{verb}` convention (no registry) + altitude
  note (ops-health reads CloudWatch/structured-log, NOT audit).
- **PLAT-IDENTITY-1** role/scope claim pinned: JWT `roles` claim + `GET /api/principals/{iri}`; RBAC
  via PLAT-SETTINGS-1; project/domain-role post-workspace-drop (Build v1 SECURITY gap source).
- **PLAT-SETTINGS-1** collapsed 4-level→**3-level Company→Domain→Project + super-admin**; workspace
  re-homes to Domain, collision→tighter-wins; M1 transitional note (M1 code may still carry
  workspace_id; specs authoritative M2+).
- **PLAT-BILLING-1** read surface added `GET /api/billing/usage?group_by&granularity` → {rows,as_of}.
- **GE-CANVAS-1** filterByIri slice semantics PINNED (in-slice edges normal; boundary edges = stub
  markers; conformant builds return same slice) — fixes GE Major (locked contract, undefined slice).

Fable addendum items folded in: CE-EVENT-1 ban rationale = build-order coupling dissolved by stubs
(GE polls seq feed, no new surface); Build v1 role-claim promoted to Phase 1 (done above);
cross-engine reframe grep must include invariants/delta/gate files (handed to GE + Build architects).

## Phase 2 — 6-agent parallel remediation team dispatched (2026-07-08, background)

Partitioned by engine-OWNER (not milestone) so no two agents write the same PO-artifact file. Each got
its red-team findings + settled contract facts + workspace re-home + stale-PO-tag fix. contracts.md is
read-only to all (coordinator is sole writer). Agents: CE(M2+v1), Platform(M2+v1), Build(M2+v1), GE(M2),
Onboarding(M2), + program-docs workspace-purge (weave-spec/personas/dev-environment). Ruling-fallout
(GE CE-409 purge, Build NotExecutableUntilPostV1 rename) handed to owning architects. Awaiting receipts
→ Phase 3 (re-verify → progress.json seed → anatomy → commit → push).

## Cross-engine reconciliations resolved

- Human-principal IRI: NOT a gap — M1 PLAT-TASK-004 mints it in the JWT claim. Doc fixed.
- Build M2 ≠ GE-CANVAS-1 consumer (that's Build v1.0 FR-032, post-v1). Build M2 = Legibility+Trust.

## WS1-GAP verification + closure pass (2026-07-08, orchestrator session)

**Verification (6 parallel agents, main @ f677b7e):** Build M2+v1, GE M2, CE M2+v1, Platform M2+v1
all red-team Blockers/Majors CLOSED (incl. Platform v1 SSRF — comprehensive mitigation in
v1-delta §2a). Onboarding M2 closed on its side but CE side of the competency ruling was
unexecuted. Full evidence in the verification agents' reports (session f9432b24, 2026-07-08).

**New user rulings (MCQ 2026-07-08):**
- **Milestone dirs: literal merge** — m2/ folds into v1/ per engine, one contiguous task
  numbering, progress.json reseeded. (Supersedes the sibling-dirs layout.)
- **CE + GE specs: merge** — into one spec tree, INCLUDING historic m1 artifacts; keep existing
  naming conventions (no new codename); renumber only on ID collision.
- **Billing rate card (dollar conversion): post-v1.** PLAT-BILLING-1 `cost` = null until then;
  consumers render counts. Contract note applied.
- **Email channel (SES): post-v1.** PLAT-NOTIFY-1 note applied; digest preference UI-gated.
- **Never delete descoped task briefs** — anything moved post-v1 keeps its task file, relocated
  to the engine's `post-v1/tasks/` dir.

**Closure edits this pass:** contracts.md — CE-READ-1 kind `description` (skos:definition,
CE M2 TASK-011), PLAT-NOTIFY-1 email-post-v1 + publish-notification behaviour, PLAT-IDENTITY-1
role-vocabulary pointer (10 roles + super admin), PLAT-BILLING-1 cost-null-until-rate-card.
Engine fixes dispatched to 3 agents: CE (AC-010-07 phantom clause, v1.0→post-v1 tags, ADR-001
retext, FR-043 pointer, TASK-011 brief), Platform (SSRF canonicalisation addendum, stale 4-level
cascade sweep in architecture/business-process/testing-strategy, rate-card + SES post-v1 notes,
tenancy write-back, S3 erratum), Onboarding+personas (7 workspace-cascade lines, 3 authority tags).

**Follow-ups closed:** GE dup ADR-004 (already fixed), prop-freeze rule present (frontmatter
confirm → PROJ-009c), elicit-skill bug → PROJ-008, conformance tests → PROJ-009, S3 erratum +
personas tags + FR-043 + competency clause → dispatched above.

## Milestone folder merge m2 -> v1 (2026-07-08, task #12 of the consolidation plan)

Executed the literal-merge ruling: every engine's `m2/` folded into a single `v1/` milestone
folder. E&A `post-v1/` and all `m1/` folders untouched.

**Numbering rule:** ex-m2 briefs KEEP their numbers (externally cited everywhere as "M2 TASK-NNN",
now labelled "v1 TASK-NNN"); old-v1 briefs renumbered upward:

| Engine | ex-m2 (kept) | old-v1 -> new |
|---|---|---|
| constitution-engine | TASK-001..011 | TASK-001..008 -> TASK-012..019 |
| build-engine | TASK-001..009 | TASK-001..014 -> TASK-010..023 |
| weave-platform | TASK-010..017,024 | unchanged (already globally numbered 006,018..023,025) |
| graph-explorer | TASK-001..011 | (no old v1) |
| onboarding | TASK-001..005 | (no old v1) |

**progress.json reseeded:** 106 tasks (31 done preserved; +CE-V1-TASK-011 kind-descriptions brief),
53 epics (`*-M2-EPIC-*` renamed `*-V1-EPIC-*`; BE/PLAT EPIC-002 milestone-span duplicates merged),
phase_plan 12 -> 9 phases (one v1 phase per engine). Task IDs: `*-M2-TASK-*` -> `*-V1-TASK-*`.

**Sweeps:** brief frontmatter `milestone:`/tags -> v1; all `m2/tasks/` paths -> `v1/tasks/`;
prose "M2 TASK-NNN" -> "v1 TASK-NNN"; old-v1 external citations renumbered (constitution-engine.md
E12 story list, ADR-011, BE v1-delta). One hand-fix: BE v1 TASK-023 bare "(TASK-010)" meaning the
m1 repo-bootstrap task, disambiguated to "(m1 TASK-010)". `tech-spec/m2-delta.md` filenames kept
(historical delta records). Dated entries earlier in THIS file keep their original "M2 TASK" labels
as history — map via the table above.

## CE + GE spec-tree merge (2026-07-08, task #13 — WS1-GAP ruling "CE + GE specs: merge")

User MCQ rulings: surviving tree = `engines/constitution-engine/`; tracker IDs re-keyed GE→CE;
colliding tech-spec filenames renamed with `-explorer` suffix (pure `git mv`, no content merge).

**File + ID mapping (renumber-on-collision only; ex-GE numbers shift, CE numbers untouched):**

| Ex-GE artifact | New location / ID | Offset |
|---|---|---|
| m1 TASK-001..005 | constitution-engine/m1/tasks/TASK-009..013 (tracker GE-TASK-00N → CE-TASK-0(N+8)) | +8 |
| v1 TASK-001..011 | constitution-engine/v1/tasks/TASK-020..030 (tracker GE-V1-TASK-0NN → CE-V1-TASK-0(NN+19)) | +19 |
| ADR-001..008 (suffixed names kept) | constitution-engine/decisions/ADR-014..021-* | +13 |
| Doc epics EPIC-001..010 (tracker GE-EPIC / GE-V1-EPIC) | EPIC-013..022 (CE-EPIC-013/014 + CE-V1-EPIC-015..022) | +12 |
| graph-explorer.md §1–§4 | constitution-engine.md §5–§8 ("Graph Explorer — Brief/PRD/Epics/Roadmap") | §+4 |
| tech-spec architecture/business-process/data-model/invariants/testing-strategy/m2-delta.md | same names + `-explorer` suffix | rename |
| tech-spec/ge-canvas-1.md, 00-elicit/20Q-oq09-predicate-closure.md | moved unchanged | — |

- Contract IDs unchanged (`GE-CANVAS-1` etc.) — contracts.md stays canonical; only paths updated.
- progress.json: 106 tasks / 53 epics, 31 done preserved; phase_plan 9→7 (graph-explorer phases
  folded into constitution-engine phases); engines `graph-explorer[-v1]` → `constitution-engine[-v1]`.
- State spine: summaries GE-TASK-001/002/005.md renamed to CE-TASK-009/010/013.md;
  qa-cross-task-findings + qa-project-issues live pointers re-keyed. Escalations
  (`GE-TASK-001-resolved.md`, `TASK-001-blocker.md`), `spec-reviews/graph-explorer.md`, PHASE-*
  summaries and dated ledger entries keep historical GE labels (same precedent as the m2→v1 merge).
- "GE" as a *surface/prose* name survives (weave-spec build-order row #3, contracts.md §3 heading);
  only the spec tree, file IDs, and tracker IDs merged.

## WS2 design assessment rulings (2026-07-09, user MCQs)

Full package: `docs/design/MORNING-REVIEW.md`; findings `docs/design/design-assessment-2026-07-09.md`.

1. **Visual direction = V4 hybrid** — V3 canvas-first body (floating glass panels, NL ask bar with
   speech input, grounded-answer glow, V3 Instances/Ask) + V2 chrome (icon rail + contextual
   sidebar, slim header, gradient-border command/search bar, ⌘K palette, border-based elevation)
   + real `logo.png` mark. Recipe: `docs/design/visual-direction.md`; reference mock
   `docs/design/mocks/mock-v4-hybrid.html`. Canvas-first applies to Constitution/Explore only.
2. **All 5 demo Blockers → v1 requirements now** (F-D10 empty dashboard, F-D11 no instance
   browser, F-D15 broken canvas layout, F-D18 silent NL query, F-D25 dead marketing CTAs).
3. **Compliance stays under Audit trail**; route fixed to `/audit/compliance` (F-D23); spec-vs-IA
   naming reconciliation stays deferred to M2 as previously agreed.
4. **Design agent approved** (spec-time brief sections + QA-time verification, sonnet) — advisor
   consult ADV-007; wiring commits carry the trailer.
5. **`model.version.published` = all members, batched per session** (collapsed multi-publish
   entries) — honours "publish notifies members" without authoring spam.
6. **Tenancy wording sweep confirmed as v1 requirement** (F-D04): no member-visible workspace
   switcher, company-scope copy, super-admin provisioning list unchanged; E2E uses direct URLs.

Requirements ledger for the architect pass: `docs/design/v1-design-requirements.md` (R1–R12).
