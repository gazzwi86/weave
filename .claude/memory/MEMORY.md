## Index

- [Branding & standards naming](feedback_branding_standards_naming.md) — page/nav rename + brand-rule wording + CRUD both tabs
- [Dumb/smart component split is enforced](feedback_dumb_smart_components.md) — all UI in Storybook atomic lib; pages = data-binding only, no CSS
- [No milestone phase pills in UI](feedback_no_phase_pills.md) — shipped = no pill; unbuilt = disabled + "soon"; supersedes poc-ia-proposal pills
- [UI refit program (mock-first)](project_ui_refit.md) — refit-mock.html per section → sign-off → apply; phase 1 shell signed off 2026-07-17

- [Pre-delivery hardening decisions (2026-07-02)](decision_predelivery-hardening.md) — M1 scope, persona dispositions, two-tier models, hooks, engine-end HITL gates
- [Platform strategy](decision_platform-strategy.md) — OS for AI-native company / DTO; model→generate→automate on open standards (moat = closure, not triples); BPMO framework; build order Platform shell → CE → Explorer → Build → Events → Onboarding; MVP = thin loop
- [Ontology — the BPMO business brain](decision_ontology-bpmo.md) — CE ships a process-centric BPMO (~13 kinds, obpm-grounded), SUPERSEDES the thin 8-kind core; prototype-grounding (obpm = ontology ref, weave-prototype = impl ref); ingest pipeline + agent-grounding; OCEL/REA/UFO/federation = recorded doors, built none in v1
- [Harness architecture decisions](decision_harness-architecture.md) — per-artifact skills, phase-gated dark factory, /goal loop (confirmed real), phase_gate() hook, .claude/skills/ only
- [Harness redesign in progress](project_harness-redesign.md) — TASK ZERO done; /goal confirmed; skills being created via Workflow (expires 2026-07-14)
- [Naming convention — no codenames](decision_naming-convention.md) — descriptive human-intelligible names only; drop BluShift→Weave, Polaris→self-improvement engine
- [AWS access via named profile gazzwi86](reference_aws_profile.md) — AWS_PROFILE=gazzwi86 (pre-authed); never hunt AWS key/secret env vars
- [QA preflight vs parallel lanes](process_qa-preflight-vs-parallel-lanes.md) — QA agent needs the task summary to exist before it validates; ADV-004 lanes can't write state, so coordinator pre-writes the summary from the lane receipt before launching QA
- [Tenancy realignment — workspace ≡ company (2026-07-08)](decision_tenancy-workspace-alignment.md) — spec wins over intra-tenant sub-workspaces; operator-console provisioning; 10 roles + project grants; publish notifies members
- [GitHub Actions CI RESTORED 2026-07-10](project_ci_credits_outage.md) — CI back early; waiver LIFTED, run CI gates for real; expect main red post-merge (#48/#49 + lane branches), fix before stacking
- [Never delete descoped task briefs](feedback_never-delete-descoped-briefs.md) — post-v1 descopes move briefs to post-v1/tasks/, never delete
- [Ask decisions in-flight, don't defer](feedback_ask-decisions-in-flight.md) — blocking decision surfaces mid-task → AskUserQuestion immediately, never report-and-wait
- [projects table has no domain_id (2026-07-10)](project_projects-domain-id-gap.md) — kills every domain/project-scoped cascade (roles/budget/rate-card); one migration + scope-grammar extension closes ADR-012 + ADR-013 + XT-BE013-1; phase-gate item
- [Parallel lanes cap = 5 (2026-07-10)](feedback_parallel-lanes-cap-5.md) — user raised /implement concurrent lanes from 3 to 5, dependency-graph gated; ADV-004 isolation rules still hold; docker interim = 1 lane on shared stack
- [Docker test marker (2026-07-10)](reference_docker-test-marker.md) — use `-m "integration and docker and not stack"`; plain marker pulls a stack test that runs `docker compose down -v` mid-run and corrupts the shared fixture
- [mutmut runs unit suite twice in-process (2026-07-10)](reference_mutmut-double-inprocess-run.md) — mutmut baseline runs full unit suite TWICE in one interpreter (stats + clean-tree); module-level once-per-process state fails on 2nd pass → red baseline → 0 killed → gate FAIL. Reset the state in the test. Sibling of the chdir landmine.
- [mutmut mutants/ path landmine (2026-07-15)](reference_mutmut-mutants-path-landmine.md) — test reading a repo file via fixed-depth `parents[N]`/relative path AT MODULE LEVEL breaks mutmut baseline under its `mutants/` sandbox (extra path segment) → collection error → both mutation jobs fail fast. Walk up to a repo-root marker + read lazily. Hit CE-030 + ONB-005.
- [Legacy "admin" role = super-admin sentinel (2026-07-19)](reference_legacy-admin-role-sentinel.md) — don't canonicalize seed admin/author roles; provisioning gates on literal "admin"; SE2 fixed at frontend label in #181
- [Epic-close CI-discipline](reference_epic-close-ci-discipline.md) — poison-endpoint hermeticity (PROJ-014), whole-repo ruff, OKF gate, migration/ADR numbering; run these before pushing any reconciled epic branch
- [clock_timestamp FIFO bug class](reference_clock-timestamp-fifo-bug.md) — DEFAULT now() freezes per-txn → tied created_at → nondeterministic ORDER BY tie-break → isolation-pass/full-suite-flake; fix = clock_timestamp() (migrations 0065, 0083)
- [Canonical Home = Dashboard; ge-canvas = project Explore (2026-07-18)](decision_home-and-canvas-surfaces.md) — T4 MCQ: /dashboard is canonical post-login Home (role-home folds in); /build/ge-canvas-preview → project-filtered Explore
- [Local build + axe-m2 flake gotchas](reference_local-build-and-axe-flake-gotchas.md) — explorer-a11y-m2 axe race FIXED #167 (per-tab data-testid); residual base-sensitivity only (rerun/rebase); polluted frontend deps break local Next-16 turbopack build (clean reinstall in packages/frontend), CI unaffected
