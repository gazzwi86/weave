## Index

- [Pre-delivery hardening decisions (2026-07-02)](decision_predelivery-hardening.md) — M1 scope, persona dispositions, two-tier models, hooks, engine-end HITL gates
- [Platform strategy](decision_platform-strategy.md) — OS for AI-native company / DTO; model→generate→automate on open standards (moat = closure, not triples); BPMO framework; build order Platform shell → CE → Explorer → Build → Events → Onboarding; MVP = thin loop
- [Ontology — the BPMO business brain](decision_ontology-bpmo.md) — CE ships a process-centric BPMO (~13 kinds, obpm-grounded), SUPERSEDES the thin 8-kind core; prototype-grounding (obpm = ontology ref, weave-prototype = impl ref); ingest pipeline + agent-grounding; OCEL/REA/UFO/federation = recorded doors, built none in v1
- [Harness architecture decisions](decision_harness-architecture.md) — per-artifact skills, phase-gated dark factory, /goal loop (confirmed real), phase_gate() hook, .claude/skills/ only
- [Harness redesign in progress](project_harness-redesign.md) — TASK ZERO done; /goal confirmed; skills being created via Workflow (expires 2026-07-14)
- [Naming convention — no codenames](decision_naming-convention.md) — descriptive human-intelligible names only; drop BluShift→Weave, Polaris→self-improvement engine
- [AWS access via named profile gazzwi86](reference_aws_profile.md) — AWS_PROFILE=gazzwi86 (pre-authed); never hunt AWS key/secret env vars
- [QA preflight vs parallel lanes](process_qa-preflight-vs-parallel-lanes.md) — QA agent needs the task summary to exist before it validates; ADV-004 lanes can't write state, so coordinator pre-writes the summary from the lane receipt before launching QA
- [Tenancy realignment — workspace ≡ company (2026-07-08)](decision_tenancy-workspace-alignment.md) — spec wins over intra-tenant sub-workspaces; operator-console provisioning; 10 roles + project grants; publish notifies members
- [GitHub Actions unavailable until 2026-08-01](project_ci_credits_outage.md) — CI credits exhausted; gates use local verification + waiver until reset
- [Never delete descoped task briefs](feedback_never-delete-descoped-briefs.md) — post-v1 descopes move briefs to post-v1/tasks/, never delete
- [Ask decisions in-flight, don't defer](feedback_ask-decisions-in-flight.md) — blocking decision surfaces mid-task → AskUserQuestion immediately, never report-and-wait
