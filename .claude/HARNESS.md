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
| arch-contracts | skill | Produces openapi.yaml (3.1.0, FastAPI + Pydantic v2, HITL batches of 3-5 endpoints) and data-model.md (relational + semantic layers) | Agent: tech-architect (one section/batch at a time, HITL) | No API contract or data model spec | active | TODO |
| arch-delivery | skill | Produces ci-cd.md (GitHub Actions pipeline, lint -> prod deploy) and infrastructure.md (VPC topology, Terraform modules, cost estimate) | Agent: tech-architect (when CI/CD or infra design is needed) | No CI/CD pipeline or infrastructure spec | active | TODO |
| arch-diagrams | skill | Produces C4 architecture.md (L1-3), class-diagram.md, and business-process.md, each delivered incrementally with HITL | Agent: tech-architect (C4 -> class diagram -> flows, in sequence) | No architecture model, domain model, or process-flow docs | active | TODO |
| arch-quality | skill | Produces testing-strategy.md, definition-of-done.md, and definition-of-ready.md with HITL gates | Agent: tech-architect (tech-spec phase) / implement skill (DoR gate) | No test strategy, DoD, or DoR gate | active | TODO |
| arch-stack | skill | Confirms and locks stack.md before any other arch artifact | Agent: tech-architect (first arch skill) | Later arch artifacts are written against an unsettled stack | active | TODO |
| arch-task-brief | skill | Produces self-contained TASK-NNN.md (engineer needs no other file) | Agent: tech-architect (once per task) | Engineer has no actionable, self-contained task | active | TODO |
| dependency-check | skill | Verifies system deps + credentials before scaffolding and at each phase boundary | Agent: implement (pre-scaffold, phase boundaries) | Scaffolding fails mid-run on missing deps/creds | active | TODO |
| design-system | skill | Establishes docs/standards/design/ + DTCG tokens (serves the CE-BRAND-1 contract) | Agent: product-owner (UI-bearing projects only) | UI projects ship without design tokens / brand contract | active | TODO |
| elicit | skill | Structured elicitation: Six Hats, Five Whys, Twenty Questions, Stochastic | User: /elicit or Agent: on conflicting requirements / unclear root cause | Requirements and decisions are gathered ad hoc | active | TODO |
| implement | skill | Runs the PDAC loop: Architect curates -> Engineer TDD -> QA validates, phase-gated | User: /implement | No implementation loop | active | TODO |
| init | skill | Scaffolds the .claude/ spec+state spine and docs/ standards; resolves tech stack (greenfield-only init) | User: /init | No project scaffold exists; nothing else in the harness can run | active | TODO |
| okf-validate | skill | Validates the docs/ OKF bundle for v0.1 conformance (hard errors + soft warnings) | User: /okf-validate | OKF bundle drift goes undetected | active | TODO |
| okf-visualize | skill | Renders docs/viz.html — a self-contained Cytoscape.js knowledge graph | User: /okf-visualize | No visual knowledge graph of the bundle | active | TODO |
| phase-gate | skill | Evaluates all quality gates before a phase advances | Stop hook when progress.sh phase-check returns COMPLETE | Phases advance without meeting their gate | active | TODO |
| po-epic | skill | Produces one EPIC-NNN.md per epic with HITL | Agent: product-owner (repeated per epic) | Epics are undefined; the roadmap has nothing to sequence | active | TODO |
| po-strategy | skill | Produces brief.md, PRD, and roadmap in strict sequence, each gated on the prior part's approval | Agent: product-owner (first three PO artifacts) | No brief, requirements doc, or phased delivery plan | active | TODO |
| project-memory | skill | Saves project-scoped facts (conventions, decisions, state, pointers) to MEMORY.md | User: /remember or Agent: saving a project-level fact | Team decisions/conventions are not persisted | active | TODO |
| spec-review | skill | Reviews all specs for completeness, consistency, implementation-readiness | User: /spec-review or Agent: implement (pre-scaffold) | Broken/incomplete specs reach implementation | active | TODO |
| status | skill | Renders the kanban progress dashboard + suggested next action | User: /status or /implement status | No progress/blocker visibility | active | TODO |
| engineer | agent | Implements tasks via strict TDD from self-contained briefs; scaffolds boilerplate on first run | implement loop (PDAC build phase) | No code gets written | active | TODO |
| product-owner | agent | Orchestrates PO artifacts brief -> PRD -> epics -> roadmap; delegates writing to skills | User: /po | The PO phase has no driver | active | TODO |
| quality-assurance | agent | Validates implementation vs spec, extends tests, produces structured failure reports | implement ASSESS phase or User: /qa | The QA phase has no driver | active | TODO |
| tech-architect | agent | Reads approved PO artifacts and invokes the arch-* skills in sequence | User: /architect | The architect phase has no driver | active | TODO |
| harness_manifest.py | script | Derives + gates this manifest (generate / --check structural row-parity) | pre-push (check-harness-manifest) and manual generate | Harness elements silently drift out of the manifest | active | TODO |
| hooks.py | script | Central hook dispatcher; fans events out to modules/ handlers (exit 2 = block) | settings.json hook events + pre-push (CLI handlers) | All hook enforcement (secrets, uv, git-safety, anatomy, memory) goes dark | active | TODO |
| okf_validate.py | script | Validates the docs/ OKF bundle (hard errors + soft warnings); emits JSON | okf-validate skill | OKF conformance is unchecked | active | TODO |
| okf_visualize.py | script | Renders docs/viz.html (self-contained Cytoscape.js graph) | okf-visualize skill | No knowledge-graph visualisation | active | TODO |
| progress.sh | script | State-spine CLI over progress.json (kanban/ready/phase-check/update) | implement loop, phase-gate, status skill | Orchestration loses phase/task state | active | TODO |
| restack.sh | script | Rebases open stacked epic branches onto their merged base (git rebase --onto cascade + --force-with-lease), stopping on conflict | implement loop Step 1.0b (restack-on-merge), operator | Merged-base stacks drift and conflict; PRs can't merge in order | active | TODO |
| run-loop.sh | script | Deterministic driver for limit-spanning /implement runs: fable→opus fallback, sleep-on-limit, halts at every HITL gate (ADR-H1 reopen) | Operator: bash .claude/scripts/run-loop.sh | Long runs die at the first usage limit and need manual restarts | active | TODO |
| statusline.sh | script | Prints the custom Claude Code status line | settings.json statusLine.command | Status line falls back to the default | active | TODO |
| ui_verify.sh | script | Deterministic UI verification (functional click-through + structural assertions + axe) on committed fixtures | phase-gate (re-executed) and implement | UI regressions / inaccessible UI ship unblocked | active | TODO |
| audit.py | module | Best-effort audit trail of hook invocations; snapshots transcript on policy gates | hooks.py main() (all events, guarded try/except) | No audit trail of hook/policy events | active | TODO |
| circular_deps.py | module | PARKED — CommonJS circular-dep walker; module kept, dispatch entry removed; re-enable via madge --circular | None (dispatch entry intentionally removed) | Nothing now (parked); re-enabling restores cycle detection | active | TODO |
| common.py | module | Shared utils: PROJECT_ROOT, area_for_path(), block(), rel_from_root(), transcript helpers | Imported by every hook module | All hook modules lose their shared helpers | active | TODO |
| git_safety.py | module | PreToolUse check-git-safety — blocks git push/commit --no-verify | hooks.py PreToolUse: check-git-safety | --no-verify bypasses every pre-push gate | active | TODO |
| install_safety.py | module | PreToolUse check-install-safety — vuln check before installing npm/pip dependencies | hooks.py PreToolUse: check-install-safety | Vulnerable dependencies are installed unchecked | active | TODO |
| lifecycle.py | module | commit_progress (PostToolUse), notification, check_setup_status, subagent/pre-compact/session-end | hooks.py PostToolUse + several lifecycle events | progress.json auto-commit and setup warning stop firing | active | TODO |
| limits.py | module | StopFailure handler: records usage-limit/billing failures to .claude/state/limit-hit + desktop ping | hooks.py stop-failure (settings.json StopFailure, matcher rate_limit / billing_error) | run-loop.sh loses its limit signal; limit deaths go unnoticed | active | TODO |
| memory.py | module | Memory flush nudge, user_prompt_submit trigger, session-start MEMORY.md injection | hooks.py stop + user-prompt-submit + session-start | MEMORY.md is not injected; save nudges stop | active | TODO |
| python_tooling.py | module | PreToolUse check-uv-over-pip — enforce uv-only Python tooling | hooks.py PreToolUse: check-uv-over-pip | Bare pip usage slips through | active | TODO |
| secrets.py | module | PreToolUse check-no-secrets — scan new content for secrets / dangerous patterns | hooks.py PreToolUse: check-no-secrets | Hardcoded secrets can land in commits | active | TODO |
| stop.py | module | Stop event — phase_gate + drift_check (token estimate + local-LLM compact/clear advice) | hooks.py stop | Phase gating and context-drift detection stop | active | TODO |
| wiki.py | module | PostToolUse mark_anatomy_stale + check_anatomy_fresh pre-push freshness gate | hooks.py PostToolUse + pre-push (CLI) | Wiki staleness is untracked; stale wiki can be pushed | active | TODO |
