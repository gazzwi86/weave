# Harness manifest — `.claude/HARNESS.md`

**DERIVED FILE — do not hand-edit this prose.** Rows are scaffolded by
`python3 .claude/scripts/harness_manifest.py generate`, which scans the harness
(skills, agents, scripts, modules) and preserves human-authored cells across
regeneration. Edit the *table cells* (Purpose / Invoked by / Breaks without it /
last-vouched-by), then re-run `generate`.

The pre-push gate (`check-harness-manifest`) enforces **structural row-parity**:
every discovered harness element must have a row (else the push is blocked).
`last-vouched-by: TODO` is a WARN, not a block — a human vouches for a row by
replacing TODO with `<name> <date>` once they have confirmed it is accurate.

| Element | Type | Purpose | Invoked by | Breaks without it | Status | last-vouched-by |
|---|---|---|---|---|---|---|
| arch-adr | skill | Records a single architectural decision as ADR-NNN.md | Agent: tech-architect / engineer (undocumented decision) | Architectural decisions are lost or contested | active | TODO |
| arch-c4 | skill | Produces C4 architecture.md (Levels 1-3) with HITL | Agent: tech-architect | No formal architecture model | active | TODO |
| arch-cicd | skill | Produces ci-cd.md (full GitHub Actions workflow, lint -> prod deploy) | Agent: tech-architect | No CI/CD pipeline spec | active | TODO |
| arch-class | skill | Produces class-diagram.md (Mermaid classDiagram) | Agent: tech-architect (after C4 approved) | Domain model is undocumented | active | TODO |
| arch-data-model | skill | Produces data-model.md (relational Aurora/SQLAlchemy + semantic OWL/Oxigraph/SHACL) | Agent: tech-architect | No DB or ontology schema | active | TODO |
| arch-dod | skill | Produces a mechanically-verifiable definition-of-done.md | Agent: tech-architect (after tech spec drafted) | QA has no verifiable completion bar | active | TODO |
| arch-dor | skill | Produces definition-of-ready.md (prerequisites before a task starts) | Agent: tech-architect or implement skill | Tasks start without prerequisites confirmed | active | TODO |
| arch-flows | skill | Produces business-process.md, one flow at a time with mandatory Mermaid | Agent: tech-architect | Data/control flow through the system is undocumented | active | TODO |
| arch-infra | skill | Produces infrastructure.md (VPC topology, Terraform module structure, cost estimate) | Agent: tech-architect | No infrastructure spec | active | TODO |
| arch-openapi | skill | Produces openapi.yaml (3.1.0, FastAPI + Pydantic v2) in HITL batches | Agent: tech-architect | No API contract | active | TODO |
| arch-stack | skill | Confirms and locks stack.md before any other arch artifact | Agent: tech-architect (first arch skill) | Later arch artifacts are written against an unsettled stack | active | TODO |
| arch-task-brief | skill | Produces self-contained TASK-NNN.md (engineer needs no other file) | Agent: tech-architect (once per task) | Engineer has no actionable, self-contained task | active | TODO |
| arch-testing | skill | Produces testing-strategy.md (unit/integration/E2E, HITL gates) | Agent: tech-architect | No test strategy | active | TODO |
| dependency-check | skill | Verifies system deps + credentials before scaffolding and at each phase boundary | Agent: implement (pre-scaffold, phase boundaries) | Scaffolding fails mid-run on missing deps/creds | active | TODO |
| design-system | skill | Establishes docs/standards/design/ + DTCG tokens (serves the CE-BRAND-1 contract) | Agent: product-owner (UI-bearing projects only) | UI projects ship without design tokens / brand contract | active | TODO |
| discover | skill | Graphify static analysis + git-history signals -> architectural snapshot without touching source | Agent: tech-architect (brownfield path) | Brownfield onboarding has no code-reality snapshot to reconcile against | active | TODO |
| elicit | skill | Structured elicitation: Six Hats, Five Whys, Twenty Questions, Stochastic | User: /elicit or Agent: on conflicting requirements / unclear root cause | Requirements and decisions are gathered ad hoc | active | TODO |
| extract-prototype | skill | Scans prototypes, elicits what to keep, folds artefacts into the main spec | Agent: tech-architect (auto when prototype/ exists) | Prototype learnings never reach the spec | active | TODO |
| implement | skill | Runs the PDAC loop: Architect curates -> Engineer TDD -> QA validates, phase-gated | User: /implement | No implementation loop | active | TODO |
| init | skill | Scaffolds the .claude/ spec+state spine and docs/ standards; resolves tech stack (greenfield + brownfield paths) | User: /init | No project scaffold exists; nothing else in the harness can run | active | TODO |
| interview | skill | Structured role-based SME interviews capturing tribal knowledge and undocumented patterns | User: /interview or Agent: reconcile (needs human context) | Tribal knowledge is never captured into durable context | active | TODO |
| okf-validate | skill | Validates the docs/ OKF bundle for v0.1 conformance (hard errors + soft warnings) | User: /okf-validate | OKF bundle drift goes undetected | active | TODO |
| okf-visualize | skill | Renders docs/viz.html — a self-contained Cytoscape.js knowledge graph | User: /okf-visualize | No visual knowledge graph of the bundle | active | TODO |
| phase-gate | skill | Evaluates all quality gates before a phase advances | Stop hook when progress.sh phase-check returns COMPLETE | Phases advance without meeting their gate | active | TODO |
| po-brief | skill | Produces brief.md one section at a time with HITL | Agent: product-owner (first PO artifact) | No project brief; the PO cascade has no starting artifact | active | TODO |
| po-epic | skill | Produces one EPIC-NNN.md per epic with HITL | Agent: product-owner (repeated per epic) | Epics are undefined; the roadmap has nothing to sequence | active | TODO |
| po-prd | skill | Produces the PRD; output feeds roadmap + architect phases | Agent: product-owner (after brief approved) | No requirements document | active | TODO |
| po-roadmap | skill | Produces the phase-structured roadmap with explicit HITL gate criteria | Agent: product-owner (after PRD approved) | No phased delivery plan or gate criteria | active | TODO |
| project-memory | skill | Saves project-scoped facts (conventions, decisions, state, pointers) to MEMORY.md | User: /remember or Agent: saving a project-level fact | Team decisions/conventions are not persisted | active | TODO |
| prototype | skill | Manages rapid prototypes in prototype/{name}/ with their own stack | User: /prototype or 'spike'/'POC' | No isolated spike/prototype workflow | active | TODO |
| qa | skill | Validates implementation vs task brief/AC/DoD; extends edge-case tests; pass/fail reports | Agent: quality-assurance (implement ASSESS) or User: /qa | Implementation ships unvalidated against the spec | active | TODO |
| reconcile | skill | Compares Graphify code reality vs docs; wiki-lint hygiene; conflict detection | Agent: tech-architect (brownfield) / phase-gate check | Drift between code and docs goes undetected | active | TODO |
| scout | skill | Single-domain brownfield investigator in an isolated context; writes findings, returns a pointer | Spawned by an orchestrator agent on large repos | Large-repo investigation pollutes the orchestrator's context window | active | TODO |
| spec-review | skill | Reviews all specs for completeness, consistency, implementation-readiness | User: /spec-review or Agent: implement (pre-scaffold) | Broken/incomplete specs reach implementation | active | TODO |
| status | skill | Renders the kanban progress dashboard + suggested next action | User: /status or /implement status | No progress/blocker visibility | active | TODO |
| engineer | agent | Implements tasks via strict TDD from self-contained briefs; scaffolds boilerplate on first run | implement loop (PDAC build phase) | No code gets written | active | TODO |
| product-owner | agent | Orchestrates PO artifacts brief -> PRD -> epics -> roadmap; delegates writing to skills | User: /po | The PO phase has no driver | active | TODO |
| prototyper | agent | Vibe-codes rapid prototypes (hardcoded data OK) in an isolated worktree | User: /prototype | No prototype executor | active | TODO |
| quality-assurance | agent | Validates implementation vs spec, extends tests, produces structured failure reports | implement ASSESS phase or User: /qa | The QA phase has no driver | active | TODO |
| tech-architect | agent | Reads approved PO artifacts and invokes the arch-* skills in sequence | User: /architect | The architect phase has no driver | active | TODO |
| harness_manifest.py | script | Derives + gates this manifest (generate / --check structural row-parity) | pre-push (check-harness-manifest) and manual generate | Harness elements silently drift out of the manifest | active | TODO |
| hooks.py | script | Central hook dispatcher; fans events out to modules/ handlers (exit 2 = block) | settings.json hook events + pre-push (CLI handlers) | All hook enforcement (secrets, uv, git-safety, anatomy, memory) goes dark | active | TODO |
| okf_validate.py | script | Validates the docs/ OKF bundle (hard errors + soft warnings); emits JSON | okf-validate skill | OKF conformance is unchecked | active | TODO |
| okf_visualize.py | script | Renders docs/viz.html (self-contained Cytoscape.js graph) | okf-visualize skill | No knowledge-graph visualisation | active | TODO |
| progress.sh | script | State-spine CLI over progress.json (kanban/ready/phase-check/update) | implement loop, phase-gate, status skill | Orchestration loses phase/task state | active | TODO |
| statusline.sh | script | Prints the custom Claude Code status line | settings.json statusLine.command | Status line falls back to the default | active | TODO |
| ui_verify.sh | script | Deterministic UI verification (functional click-through + structural assertions + axe) on committed fixtures | phase-gate (re-executed) and implement | UI regressions / inaccessible UI ship unblocked | active | TODO |
| audit.py | module | Best-effort audit trail of hook invocations; snapshots transcript on policy gates | hooks.py main() (all events, guarded try/except) | No audit trail of hook/policy events | active | TODO |
| circular_deps.py | module | PARKED — CommonJS circular-dep walker; module kept, dispatch entry removed; re-enable via madge --circular | None (dispatch entry intentionally removed) | Nothing now (parked); re-enabling restores cycle detection | active | TODO |
| common.py | module | Shared utils: PROJECT_ROOT, area_for_path(), block(), rel_from_root(), transcript helpers | Imported by every hook module | All hook modules lose their shared helpers | active | TODO |
| git_safety.py | module | PreToolUse check-git-safety — blocks git push/commit --no-verify | hooks.py PreToolUse: check-git-safety | --no-verify bypasses every pre-push gate | active | TODO |
| install_safety.py | module | PreToolUse check-install-safety — vuln check before installing npm/pip dependencies | hooks.py PreToolUse: check-install-safety | Vulnerable dependencies are installed unchecked | active | TODO |
| lifecycle.py | module | commit_progress (PostToolUse), notification, check_setup_status, subagent/pre-compact/session-end | hooks.py PostToolUse + several lifecycle events | progress.json auto-commit and setup warning stop firing | active | TODO |
| memory.py | module | Memory flush nudge, user_prompt_submit trigger, session-start MEMORY.md injection | hooks.py stop + user-prompt-submit + session-start | MEMORY.md is not injected; save nudges stop | active | TODO |
| python_tooling.py | module | PreToolUse check-uv-over-pip — enforce uv-only Python tooling | hooks.py PreToolUse: check-uv-over-pip | Bare pip usage slips through | active | TODO |
| secrets.py | module | PreToolUse check-no-secrets — scan new content for secrets / dangerous patterns | hooks.py PreToolUse: check-no-secrets | Hardcoded secrets can land in commits | active | TODO |
| stop.py | module | Stop event — phase_gate + drift_check (token estimate + local-LLM compact/clear advice) | hooks.py stop | Phase gating and context-drift detection stop | active | TODO |
| wiki.py | module | PostToolUse mark_anatomy_stale + check_anatomy_fresh pre-push freshness gate | hooks.py PostToolUse + pre-push (CLI) | Wiki staleness is untracked; stale wiki can be pushed | active | TODO |
