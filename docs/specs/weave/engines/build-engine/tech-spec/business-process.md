---
type: TechSpec
title: "Build Engine — Business Process (M1)"
description: "Process flows, state machines, and sequence diagrams for the Build Engine M1 thin loop."
tags: [build-engine, arch, tech-spec, m1, business-process]
status: Draft
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/build-engine/tech-spec/business-process.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: build-engine
---

# Build Engine — Business Process (M1)

**Graph edges:**
[Build Engine spec](../../../build-engine.md) ·
[Inter-engine contracts](../../../../contracts.md) ·
[ADR-001 Tenant isolation](../../../decisions/ADR-001-tenant-isolation.md) ·
[ADR-002 Authority extension](../../../decisions/ADR-002-authority-extension.md)

---

## Scope

This document covers **M1 only** — the thin loop from user request through AI generation,
safety gating, and artefact write-back. Flows are shown for every key M1 interaction;
anything M2+ belongs in [Deferred (M2+)](#deferred-m2).

**Reading this document:**

- Sequence diagrams show the principal-scoped dark-factory actors (PLAT-IDENTITY-1 + ADR-002).
- State machines show FSM values that map directly to `status` columns in
  [data-model.md](data-model.md).
- ENG-4 stubs (`dep-summary-handoff`, `pre-scaffold-review`) appear as labelled pass-through
  states — they exist in M1 but do not gate progress.
- HITL routing follows ADR-002 M1 base degrade: `automatable=false` OR unresolvable permission
  chain → route to human (deny-by-default, `coverage_gap`).

---

## Request Studio

### Request Studio Intake Flow

User-facing NL-to-spec flow (EPIC-001). Produces a `requests` row with `status=pending_sign_off`.

```mermaid
flowchart TD
  A([User opens Request Studio]) --> B[Enter NL prompt + graph context selection]
  B --> C{run_mode selected}
  C -->|draft_spec_only| D[AI drafts spec — high tier]
  C -->|spec_to_build| D
  C -->|spike| E[Spike harness — no record committed, no write-back]
  D --> F[Spec preview rendered to user]
  F --> G{User satisfied?}
  G -->|revise| B
  G -->|submit| H[Request saved — status=pending_sign_off]
  H --> I[Route to sign-off workflow]
  E --> J[Spike output shown — ephemeral, nothing persisted]
```

**run_mode values:**

| Mode | Behaviour | Write-back |
|---|---|---|
| `draft_spec_only` | Produce and save spec; stop before dark factory | No |
| `spec_to_build` | Spec → task briefs → full dark factory loop | Yes |
| `spike` | Ephemeral generate; no Aurora row committed | No |

---

### Request Status States

`requests.status` FSM. Maps to the `requests` table —
see [data-model.md#requests-table](data-model.md#requests-table).

```mermaid
stateDiagram-v2
  [*] --> draft : user opens Request Studio
  draft --> pending_sign_off : user submits spec
  pending_sign_off --> approved : all stakeholder sign-offs collected
  pending_sign_off --> rejected : any stakeholder rejects
  rejected --> draft : user revises spec
  approved --> queued : dark factory job enqueued
  queued --> in_progress : dark factory starts
  in_progress --> complete : write-back via BE-ARTEFACT-1 succeeds
  in_progress --> failed : gate failure + HITL exhausted / cancelled
  failed --> queued : human approves retry
  failed --> [*] : human cancels
  complete --> [*]
```

---

## Project Create Flow

M1 backend-only stub (EPIC-002). Creates the `projects` row and pins the graph version.
No Project Management UI in M1.

```mermaid
sequenceDiagram
  autonumber
  participant UI as Request Studio (browser)
  participant BE as Build Engine API<br/>(dark-factory principal — PLAT-IDENTITY-1)
  participant CE as Constitution Engine
  participant Aurora as Aurora PostgreSQL (RLS enforced)

  UI->>BE: POST /api/projects {tenant_id, name, slug}
  BE->>CE: GET /api/ontology/version (CE-VERSION-1)<br/>Pin current graph version
  CE-->>BE: {version_iri}
  BE->>Aurora: INSERT projects {project_id, tenant_id, name, slug,<br/>project_iri, pinned_graph_version_iri}
  Aurora-->>BE: project record (RLS: tenant_id bound)
  BE-->>UI: 201 Created {project_id, project_iri}
```

**Project IRI scheme:** `urn:weave:project:{tenant_id}:{slug}`

---

## Sign-Off Workflow

Collects stakeholder approvals before the dark factory loop starts. Stakeholder IRIs are
resolved from the tenant graph via CE-READ-1. Authority routing follows ADR-002 M1 base degrade.

```mermaid
flowchart TD
  A[Request status=pending_sign_off] --> B[Resolve stakeholders from CE graph<br/>weave:Actor + weave:holdsRole]
  B --> C{automatable flag on Activity?}
  C -->|automatable=true AND permission chain resolves| D[Auto-approve — skip human sign-off]
  C -->|automatable=false OR chain unresolvable| E[Notify stakeholders — Slack / email]
  E --> F{All sign-offs received?}
  F -->|all approved| G[status=approved → enqueue dark factory job]
  F -->|any rejected| H[status=rejected → notify user]
  D --> G
  H --> I[User revises spec → status=draft]
  I --> A
```

**Invariant:** unresolvable permission chain → deny-by-default (`coverage_gap`) per ADR-002 M1.
Full ODRL authority resolution is M2.

---

## Spec Lifecycle FSM

`build_specs.status` FSM — see [data-model.md#specs-tasks-tables](data-model.md#specs-tasks-tables).

```mermaid
stateDiagram-v2
  [*] --> draft : request approved
  draft --> pending_review : user submits for /spec-review gate
  pending_review --> approved : spec-review gate passes
  pending_review --> draft : gate fails — user revises
  approved --> task_generation : /architect runs, TaskBriefs written
  task_generation --> active : DoR verified on all task briefs
  active --> phase_gate : a phase completes
  phase_gate --> active : HITL approves next phase
  phase_gate --> done : all phases complete and signed off
  done --> [*]
```

---

## HITL Gate Sequence

Invoked at the end of each dark-factory phase. Fail-closed: gate failure or
`automatable=false` always routes to a human (ADR-002 B4).

```mermaid
sequenceDiagram
  autonumber
  participant DF as Dark Factory Loop
  participant Gate as phase_gate() hook
  participant HUser as Human Operator

  DF->>Gate: Phase N complete — all tasks in phase done
  Gate->>Gate: Evaluate: ACs green? cost within estimate? no open blockers?
  alt Gate passes AND automatable=true
    Gate->>HUser: Phase summary + artefacts for async review
    HUser-->>Gate: Approve
    Gate-->>DF: Resume phase N+1
  else Gate fails OR automatable=false OR permission chain unresolvable
    Gate->>HUser: Escalation package — evidence, gate_results, diff_summary
    HUser-->>Gate: Override (resume) OR Cancel (abort loop)
    Gate-->>DF: Signal resume or abort
  end
```

---

## Architect Agent Brief Generation

Generates TaskBrief records for all M1 tasks from the approved spec (TASK-002).
Brief IRI scheme: `urn:weave:brief:{task_id}`.

```mermaid
sequenceDiagram
  autonumber
  participant Spec as Approved build_spec
  participant Arch as Architect Agent<br/>(high tier)
  participant Val as Brief Validator<br/>(mid tier)
  participant Aurora as Aurora (task_briefs, build_tasks)

  Spec->>Arch: Engine spec sections (PRD + Epics + Roadmap)
  Arch->>Arch: Decompose into tasks (DoR-aligned, EARS ACs)
  Arch->>Arch: Build dep_chain, cost_estimate per task
  Arch->>Val: Validate TaskBrief schema<br/>(schema_version, task_id, ACs, dor/dod checklists)
  Val-->>Arch: Validation result
  alt Brief valid
    Arch->>Aurora: INSERT task_briefs {tenant_id, task_id, brief_iri, schema_version, content}
    Arch->>Aurora: INSERT build_tasks {task_id, tenant_id, project_iri, status=queued, phase}
    Aurora-->>Arch: Saved (RLS: tenant_id bound)
  else Invalid (≤3 attempts)
    Val-->>Arch: Violations list
    Arch->>Arch: Revise brief
    Arch->>Val: Re-validate
  end
```

---

## Repo Bootstrap Flow {#repo-bootstrap-flow}

**Run step 0** (TASK-010, FR-061 / decision B9). Before the first PLAN, the orchestrator ensures
the project's **NEW external repository** exists on the configured source-control provider
(GitHub or GitLab) and its boilerplate/harness is pushed. All generated output (TASK-008) lands in
that client-owned repo — **never inside Weave**. The provider + auth token are a project/workspace
setting (`PLAT-SETTINGS-1` for config; token in **AWS Secrets Manager** only, referenced by
`scm_token_secret_ref`). Source control is **not** a `PLAT-CONNECTOR-1` connector and is available
at M1.

```mermaid
sequenceDiagram
  autonumber
  participant Orch as Dark Factory Orchestrator<br/>(Build principal — PLAT-IDENTITY-1)
  participant Settings as PLAT-SETTINGS-1
  participant Secrets as AWS Secrets Manager
  participant Driver as ScmDriver<br/>(GitHubDriver | GitLabDriver)
  participant Repo as External repo<br/>(GitHub / GitLab)
  participant Aurora as Aurora (projects, RLS)
  participant Audit as PLAT-AUDIT-1

  Orch->>Aurora: Load project — repo already bootstrapped?
  alt project.repo_bootstrap_status = bootstrapped
    Aurora-->>Orch: existing repo handle (idempotent — reuse, no second repo)
  else not yet bootstrapped
    Orch->>Settings: Resolve source_control provider (project cascade)
    alt provider unconfigured OR unsupported
      Settings-->>Orch: no valid provider
      Orch->>Orch: RepoBootstrapError(repo_provider_unconfigured) — run NOT started (fail-closed, before PLAN)
    else provider resolved
      Orch->>Secrets: Get deploy token by scm_token_secret_ref (never logged)
      alt token missing / invalid
        Secrets-->>Orch: no token
        Orch->>Orch: RepoBootstrapError(repo_auth_invalid) — run NOT started
      else token resolved
        Orch->>Driver: select driver(provider)
        Driver->>Repo: Create-or-adopt repo (private) · set default branch
        Driver->>Repo: Push project boilerplate / harness (initial commit)
        Orch->>Aurora: Persist repo handle {repo_provider, repo_url,<br/>repo_default_branch, scm_token_secret_ref, repo_bootstrap_status=bootstrapped}
        Orch->>Audit: Emit repo_bootstrapped {provider, repo_url} — no token in event
        Note over Driver,Repo: M2 (FR-062): branch-protection rules, full CI,<br/>rich .claude-style scaffold + env-verification HITL gate
      end
    end
  end
```

**Invariants:**

- **Idempotent re-run** — a project whose `repo_bootstrap_status = bootstrapped` reuses the existing
  repo handle; a second run never creates a second repo.
- **Token never logged** — the provider token is read from Secrets Manager at use and never appears
  in any response body, log line, or `PLAT-AUDIT-1` event.
- **Fail-closed** — an unconfigured provider or invalid token halts the run **before PLAN**; the
  run is not started and no code is generated. There is no Weave-internal repo fallback.

---

## Dark Factory PDAC Sequence

The core agentic loop: Plan → Delegate → Assess → Codify (non-skippable per B3).
ENG-4 stubs are shown as pass-through states in M1.

```mermaid
sequenceDiagram
  autonumber
  participant Arch as Architect Agent<br/>(high tier)
  participant Eng as Task Engineer<br/>(mid tier)
  participant Validator as CODIFY Validator<br/>(mid tier)
  participant HITL as Human (HITL escalation)
  participant Audit as PLAT-AUDIT-1

  Arch->>Arch: PLAN — read task brief, DoR, decompose sub-tasks
  Arch->>Eng: DELEGATE — task brief with EARS ACs + dep_chain
  Note over Eng: dep-summary-handoff STUB (M1 pass-through)<br/>Row written; no merge logic yet — ENG-4 M2
  Eng->>Eng: ASSESS — implement, self-evaluate against ACs
  Note over Eng: pre-scaffold-review STUB (M1 pass-through)<br/>Gate present but non-blocking — ENG-4 M2
  Eng->>Validator: CODIFY — validate all EARS ACs, run DoD checks
  Note over Validator: CODIFY is non-skippable (B3)
  Validator-->>Eng: AC results (pass / fail per criterion)
  alt All ACs pass
    Eng->>Eng: Commit artefacts (branch + sha)
    Eng->>Audit: Emit PLAT-AUDIT-1 event {task_id, actor_principal_iri, event=task.complete}
    Eng-->>Arch: Task complete → advance phase
  else Any AC fails (attempt ≤ 3)
    Eng->>Eng: Loop back to ASSESS
  else Retry limit exceeded
    Eng->>HITL: Escalate — evidence, failing ACs, attempt count
    HITL-->>Arch: Override (resume) OR Cancel
  end
```

---

## Task State Machine

`build_tasks.status` FSM — every transition emits a PLAT-AUDIT-1 event.

```mermaid
stateDiagram-v2
  [*] --> queued : TaskBrief written + DoR verified
  queued --> in_progress : dark factory loop picks up task
  in_progress --> complete : CODIFY validates all ACs
  in_progress --> failed : CODIFY fails AND retry limit exceeded
  failed --> hitl_escalated : routes to human (automatable=false or exhausted)
  hitl_escalated --> queued : human approves retry
  hitl_escalated --> [*] : human cancels
  complete --> [*]
```

**CODIFY is non-skippable (B3):** a task cannot move to `complete` without mid tier
validation of all EARS ACs. A task in `complete` state is a DoD guarantee.

---

## App Generation Pipeline

M1 end-to-end generate flow (EPIC-008). The dark-factory principal acts under a
least-privilege IAM role (PLAT-IDENTITY-1 + ADR-002).

```mermaid
flowchart LR
  A[Pin graph version<br/>CE-VERSION-1] --> B[Read tenant graph via CE-READ-1<br/>SELECT-only · SERVICE-blocked · paginated<br/>framework ∪ tenant graphs only]
  B --> C[Generate Next.js UI<br/>mid tier]
  B --> D[Generate FastAPI API<br/>mid tier]
  C --> E[Assemble artefact bundle<br/>on isolated branch]
  D --> E
  E --> F[Run M1 safety gates — 5 gates, atomic]
  F -->|all 5 pass| G[Write-back — BE-ARTEFACT-1 via CE-WRITE-1<br/>PROV-O triples → :prov graph]
  F -->|any gate fails| H[Atomic rollback — nothing committed<br/>route to HITL escalation]
```

**M1 generate loop — illustrative control flow (not prescriptive):**

```python
# illustrative, not prescriptive — M1 generate loop
async def m1_generate_loop(job: BuildJob) -> None:
    version_iri = await pin_graph_version(job.tenant_id)          # CE-VERSION-1
    graph_data  = await paginated_read(job.tenant_id, version_iri) # CE-READ-1
    artefacts   = await generate_nextjs_fastapi(graph_data, job)   # mid tier
    gate_results = await run_m1_safety_gates(artefacts)            # 5 gates, atomic
    if all(g.result == "passed" for g in gate_results):
        await write_back(artefacts, version_iri, job)              # BE-ARTEFACT-1 → CE-WRITE-1
        await emit_audit_event(job, artefacts)                     # PLAT-AUDIT-1
    else:
        await route_to_hitl(job, gate_results)                     # automatable=false
```

---

## M1 Generate Loop — Full Sequence

Principal-scoped diagram showing dark-factory identity boundary (PLAT-IDENTITY-1 + ADR-001).

```mermaid
sequenceDiagram
  autonumber
  actor HUser as Human Operator
  participant BE as Build Engine<br/>(dark-factory principal<br/>machine-auth IAM/STS — PLAT-IDENTITY-1)
  participant RW as Query Rewriter (ADR-001)
  participant CE as Constitution Engine
  participant Gen as Code Generator<br/>(mid tier)
  participant Gates as Safety Gates ×5 (M1)
  participant Prov as RDF :prov graph

  HUser->>BE: Submit request (tenant_id, prompt, run_mode=spec_to_build)
  BE->>CE: GET /api/ontology/version — pin version_iri (CE-VERSION-1)
  CE-->>BE: {version_iri}
  BE->>RW: SPARQL SELECT via CE-READ-1 (paginated, SELECT-only, SERVICE-blocked)
  RW->>CE: Inject GRAPH scope<br/>FROM urn:weave:g:framework<br/>FROM urn:weave:g:tenant:{id}
  CE-->>BE: Paginated graph data (BPMO entities + tenant instances)
  BE->>Gen: Graph snapshot → Generate Next.js UI + FastAPI API
  Gen-->>BE: Generated artefact bundle (branch)
  loop Each of 5 M1 gates — atomic
    BE->>Gates: Run gate (secret-scan · SAST · type-check · pkg-existence · mutation≥70%)
    Gates-->>BE: result (passed | failed)
  end
  alt All 5 gates pass
    BE->>CE: POST /api/operations/apply (CE-WRITE-1)<br/>BE-ARTEFACT-1 header: {spec_id, version_iri, entity_iris}
    CE->>Prov: Write PROV-O triples to urn:weave:g:tenant:{id}:prov
    CE-->>BE: 201 Created
    BE-->>HUser: Artefact ready + write-back confirmed
  else Any gate fails — atomic rollback
    BE-->>HUser: HITL escalation (gate_results, automatable=false)
  end
```

---

## automatable Decision

ADR-002 M1 base degrade: the `automatable` flag on a `weave:Activity` or `weave:Process`
entity in the CE graph determines whether the dark factory auto-executes or routes to a human.

```mermaid
flowchart TD
  A[CE-READ-1 returns Activity / Process node] --> B{weave:automatable flag?}
  B -->|true AND permission chain resolves| C[Auto-execute dark-factory loop]
  B -->|false OR flag absent| D[Route to HITL — deny by default]
  B -->|true BUT permission chain unresolvable| D
  C --> E{All 5 M1 safety gates pass?}
  E -->|yes| F[Write-back via BE-ARTEFACT-1<br/>+ emit PLAT-AUDIT-1 event]
  E -->|no| D
  D --> G[Human review queue<br/>+ coverage_gap signal emitted<br/>+ PLAT-AUDIT-1 event]
```

---

## Gate Flow

M1 safety gate execution — **atomic**: any failure stops the run without committing.
See [gate_results table](data-model.md#gate-results-table) for storage.

```mermaid
flowchart TD
  A[Artefact bundle ready on isolated branch] --> B[1. Secret scan]
  B -->|pass| C[2. SAST — Bandit · Semgrep]
  C -->|pass| D[3. Type-check — mypy · tsc]
  D -->|pass| E[4. Package existence hard-block]
  E -->|pass| F[5. Delta mutation ≥ 70%]
  F -->|all 5 pass| G[Gates PASSED — run_id.gate_status = passed]
  B -->|fail| H[Atomic rollback — gate_results row written<br/>HITL escalation]
  C -->|fail| H
  D -->|fail| H
  E -->|fail| H
  F -->|fail| H
  H --> I[generation_run.status = failed<br/>build_task.status = failed]
```

**Gate notes:**

| Gate | Tool(s) | Failure action |
|---|---|---|
| Secret scan | trufflehog / gitleaks | Hard block — any detected secret (runs first, fail-fast) |
| SAST | Bandit (Python), Semgrep | Hard block — all findings ≥ MEDIUM |
| Type-check | mypy (Python), tsc (TypeScript) | Hard block — any type error |
| Package existence | pip/npm registry lookup | Hard block — any unresolvable package |
| Delta mutation ≥ 70% | mutation test runner (delta-scoped) | Hard block — coverage < 70% on changed lines |

CE-BRAND-1 conformance is **not a M1 gate** — deferred to M2 (B7).

---

## Gate Flow DoR DoD

Definition of Ready and Definition of Done checks in relation to the generate → gate → write-back
pipeline.

```mermaid
flowchart LR
  subgraph DoR["Definition of Ready — checked before generate starts"]
    DR1[CE-READ-1 reachable and returning data]
    DR2[graph_version_iri pinned on project]
    DR3[task_brief content validated by mid tier]
    DR4[automatable flag resolved — auto or HITL decision made]
    DR5[no unresolved blockers in build_tasks.blocked_by]
  end
  subgraph DoD["Definition of Done — all must be true"]
    DD1[All 5 M1 safety gates passed atomically]
    DD2[generation_run.artefact_iri set]
    DD3[PROV-O triples written to :prov named graph]
    DD4[PLAT-AUDIT-1 event emitted and acknowledged]
    DD5[projects.write_back_complete = true]
    DD6[CODIFY step passed — all EARS ACs green]
  end

  DoR -->|all checks green| GEN[App Generation Pipeline]
  GEN --> GAT[Gate Flow — 5 gates atomic]
  GAT -->|gates passed| WB[Deploy and Write-Back Flow]
  WB --> DoD
```

---

## Deploy and Write-Back Flow

Post-gate write-back sequence (EPIC-009). Writes the artefact to S3 and provenance to CE.
PLAT-AUDIT-1 is the append-only record — Build does not maintain its own audit store.

```mermaid
sequenceDiagram
  autonumber
  participant BE as Build Engine<br/>(dark-factory principal — PLAT-IDENTITY-1)
  participant S3 as S3 (artefact store)
  participant CE as Constitution Engine (CE-WRITE-1)
  participant RDF as RDF Store — :prov graph
  participant Audit as PLAT-AUDIT-1
  actor HUser as Human Operator

  BE->>S3: Upload generated app bundle<br/>key: {tenant_id}/{run_id}/ → output_location_ref
  S3-->>BE: S3 URI confirmed
  BE->>CE: POST /api/operations/apply (CE-WRITE-1)<br/>body: {operations, actor: principal_iri, target: tenant graph}<br/>header: BE-ARTEFACT-1 {spec_id, pinned_ce_version, entity_iris}
  CE->>RDF: Write PROV-O triples to urn:weave:g:tenant:{id}:prov
  RDF-->>CE: Triples committed
  CE-->>BE: 201 Created {prov_activity_iri}
  BE->>BE: UPDATE generation_runs SET status=passed, artefact_iri, output_location_ref
  BE->>BE: UPDATE projects SET write_back_complete=true, write_back_artefact_iri
  BE->>Audit: Emit PLAT-AUDIT-1 event<br/>{seq, ts, actor_principal_iri, engine=build,<br/>event_type=artefact.written, target_iri=artefact_iri, signature}
  Audit-->>BE: Acknowledged
  BE-->>HUser: Artefact ready notification — project.write_back_complete=true
```

**CE-WRITE-1 rejection (SHACL validation fails):** 422 with `{violations}` response.
Build re-routes to HITL — it does NOT retry blindly.

---

## ENG-4 Council Backlog: M1 Stubs

> **Conflict resolved (2026-07-01):** `build-engine.md` previously tagged **FR-043** (dep-summary
> handoff) and **FR-055** (pre-scaffold review) as **M1 Must**. They are now reconciled to
> `M1 stub / M2` in the engine spec, matching the `scope-refine` council directive — M1 = the
> pass-through stubs described below; full behaviour lands M2. This file follows that directive.

### dep-summary-handoff (ENG-4 STUB)

In M1 the CODIFY step writes a `dep_summaries` row (producing task → consuming task) but
the **consuming task does not read or gate on it**. It is a data breadcrumb only.

```mermaid
flowchart LR
  T1[Task N — CODIFY completes] -->|writes dep_summaries row| DS[(dep_summaries)]
  DS -.->|M1: row written but NOT read by consumer| T2[Task N+1 — starts unconditionally]
  DS -->|M2: consumer reads + merges before ASSESS| T2M2[Task N+1 — M2 behaviour]
  style DS fill:#fffbe6,stroke:#f0c040
  style T2M2 fill:#f0f0f0,stroke:#aaa,color:#aaa
```

### pre-scaffold-review (ENG-4 STUB)

In M1 the pre-scaffold check step is present in the PDAC flow but **non-blocking**. The mid tier
validator runs the check; a warning is emitted if it would have gated, but the loop continues.

```mermaid
flowchart LR
  D[DELEGATE phase complete] --> PSR{pre-scaffold-review check}
  PSR -->|M1: always passes — non-blocking stub| A[ASSESS begins]
  PSR -.->|M2: gate — fail = HITL| HITL_M2[HITL gate — M2 behaviour]
  style HITL_M2 fill:#f0f0f0,stroke:#aaa,color:#aaa
```

---

## Performance-Spike Degrade Note

Per [ADR-001 Consequences](../../../decisions/ADR-001-tenant-isolation.md): the CE performance
and security spike ([CE TASK-008](../../../constitution-engine/m1/tasks/TASK-008.md)) stress-
tests the query-rewriting middleware. If the spike reveals rewriter fragility:

- The degrade plan **must preserve** the M1 generate step (per weave-spec §1.2).
- Acceptable degrade: increase latency, reduce page size, add rate limiting.
- **Not acceptable:** widen graph scope to hit a latency target (cross-tenant leak risk).
- Build Engine integration tests run **only after CE M1 has landed** — do not stub the rewriter
  in integration tests.

```mermaid
flowchart LR
  Spike[CE perf-security spike] --> OK{Rewriter holds?}
  OK -->|yes| Normal[Normal M1 pipeline — full throughput]
  OK -->|no — latency spike| Degrade[Degrade: lower page size · rate limit<br/>PRESERVE generate step — never widen scope]
  Degrade --> Normal2[Generate step preserved — weave-spec §1.2 invariant]
```

---

## Deferred (M2+)

| Flow / Feature | Milestone | Reason |
|---|---|---|
| CE-BRAND-1 conformance gate in Gate Flow | M2 | B7 — out of M1 thin loop scope |
| ODRL full authority resolution in sign-off | M2 | ADR-002 phasing |
| dep-summary-handoff merge logic | M2 (ENG-4 backlog) | Cross-task resolution deferred |
| pre-scaffold-review gate (blocking) | M2 (ENG-4 backlog) | Pre-scaffold gate deferred |
| Project Management UI (PM views) | M2 | EPIC-003 is M2 |
| Multi-user real-time collab flows | Phase 2 | Explorer collab deferred to Phase 2 |
| Agent-generation flows (Build → Events integration) | M2+ | Requires Events engine M1 |
| BE-SDK-1 artefact consumption SDK | M2 | Not in M1 generate loop |
