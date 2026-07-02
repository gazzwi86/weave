---
type: Task
title: "Task: TASK-010 — Repo Bootstrap: External Project Repository (E11-S7, FR-061)"
description: "First step of every dark-factory run: create a NEW external repository per project on the configured provider (GitHub/GitLab), write project boilerplate/harness, and expose the repo handle so generation pushes output there — never inside Weave."
tags: [build-engine, arch, task, m1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-011
milestone: M1
created: 2026-07-02
blocked_by: [TASK-001]
unlocks: [TASK-006, TASK-008]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-02T00:00:00Z
resource: docs/specs/weave/engines/build-engine/m1/tasks/TASK-010.md
---

# Task: TASK-010 — Repo Bootstrap: External Project Repository (E11-S7, FR-061)

## Story

**Epic:** [EPIC-011 — Dark-Factory Execution Engine](../../../build-engine.md#epic-011--dark-factory-execution-engine)
**Status:** Backlog
**Priority:** Must Have

**As a** dark-factory orchestrator
**I want** the run's first step to create a NEW external repository for the project on the configured
source-control provider (GitHub or GitLab) and write the project boilerplate/harness
**So that** all generated output lives in a client-owned external repo — never inside Weave — before
any code is planned or generated

> **FR/decision covered:** FR-061 (external repo bootstrap = first step of a run), decision B9
> (generated output lives in a NEW external repo per project), decision B4 (no autonomous merge — the
> bootstrap creates the repo and pushes to branches; humans merge). The **rich scaffold** (branch
> protection, full CI, complete `.claude`-style harness) plus the **environment-verification HITL gate**
> is FR-062 / E11-S6 and is **M2 — out of scope here**. This M1 task is: create repo + write boilerplate
> + expose the repo handle so TASK-008 can push generated output.
>
> **Source control is NOT a `PLAT-CONNECTOR-1` connector** and is NOT deferred to v1.0. The provider
> (GitHub/GitLab) + auth token are a project/workspace setting (config via `PLAT-SETTINGS-1`; token in
> **AWS Secrets Manager only**). Available at M1.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN a dark-factory run starts for a project with no bootstrapped repo, THE SYSTEM SHALL create a NEW repository on the project's configured provider (GitHub or GitLab), persist the repo handle on the project record (`project.repo`), and return `201` with `{provider, repo_url, default_branch}` | `test_bootstrap_creates_repo_and_persists_handle` |
| AC-2 | WHEN the repo is created, THE SYSTEM SHALL write the project boilerplate/harness (spec-driven setup mirroring this repo's `.claude` harness: repo layout, conventional-commit config, base CI stub, README) as the initial commit on the default branch | `test_bootstrap_writes_boilerplate_initial_commit` |
| AC-3 | WHEN a run starts for a project whose repo already exists, THE SYSTEM SHALL be idempotent — reuse the existing repo handle and NOT create a second repo — returning `200` with the existing `{provider, repo_url, default_branch}` | `test_bootstrap_idempotent_reuses_existing_repo` |
| AC-4 | WHEN the source-control provider is unconfigured OR the auth token is invalid, THE SYSTEM SHALL halt the run **before PLAN** with a named error (`repo_provider_unconfigured` / `repo_auth_invalid`) and SHALL NOT fall back to writing inside Weave | `test_bootstrap_halts_run_when_provider_unconfigured_or_token_invalid` |
| AC-5 | WHEN the provider auth token is used, THE SYSTEM SHALL read it from AWS Secrets Manager only and NEVER return it in any API response or log line | `test_bootstrap_token_never_in_response_or_logs` |
| AC-6 | WHEN a repo is created or reused, THE SYSTEM SHALL emit a `PLAT-AUDIT-1` event (`repo_bootstrapped`) attributed to the Build service principal with `{provider, repo_url}` in the diff summary | `test_bootstrap_emits_audit_event` |
| AC-7 | WHEN the configured provider is GitHub, THE SYSTEM SHALL use the GitHub driver; WHEN it is GitLab, THE SYSTEM SHALL use the GitLab driver — provider selection is data-driven from the project/workspace setting, not hardcoded | `test_bootstrap_selects_driver_by_configured_provider` |

## Implementation

### Pseudocode

```python
SUPPORTED_PROVIDERS = ["github", "gitlab"]

def ensure_project_repo(project_iri, tenant_id):
    project = aurora.get_project(project_iri, tenant=tenant_id)      # → 404 if missing
    if project.repo:                                                 # idempotent
        return 200, {"provider": project.repo.provider,
                     "repo_url": project.repo.url,
                     "default_branch": project.repo.default_branch}

    # Resolve provider config via PLAT-SETTINGS-1 cascade; token from Secrets Manager
    cfg = settings.resolve(project_iri, "source_control")            # {provider}
    if not cfg or cfg.provider not in SUPPORTED_PROVIDERS:
        raise RepoBootstrapError("repo_provider_unconfigured")       # halts run before PLAN
    token = secrets_manager.get(f"weave/{tenant_id}/scm/{cfg.provider}/token")  # never logged
    if not token:
        raise RepoBootstrapError("repo_auth_invalid")

    driver = scm_driver(cfg.provider)                                # github | gitlab
    try:
        repo = driver.create_repo(name=repo_name(project), private=True, token=token)
    except AuthError:
        raise RepoBootstrapError("repo_auth_invalid")                # fail-closed, no Weave-internal fallback

    driver.write_initial_commit(repo, boilerplate=render_project_harness(project), token=token)
    aurora.set_project_repo(project_iri, tenant_id, repo.handle)

    audit.emit("repo_bootstrapped", actor=BUILD_PRINCIPAL, target=project_iri,
               diff_summary={"provider": cfg.provider, "repo_url": repo.url})   # no token
    return 201, {"provider": cfg.provider, "repo_url": repo.url,
                 "default_branch": repo.default_branch}
```

### API Contracts

Repo bootstrap is invoked internally as the first step of `POST /api/projects/{project_iri}/runs`
(TASK-006); it is not a separately user-called endpoint in M1. Its outcome is reflected in the run
record and on the project (`project.repo`). A read of the project (`GET /api/projects/{project_iri}`,
TASK-001) SHALL include `repo` once bootstrapped:

```json
{
  "project_iri": "string",
  "repo": {
    "provider": "string — github | gitlab",
    "repo_url": "string",
    "default_branch": "string"
  }
}
```

Run halt on bootstrap failure surfaces via the run record (TASK-006) with error
`repo_provider_unconfigured` | `repo_auth_invalid` and no generation attempted.

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| Sequence | `../tech-spec/business-process.md` | `#repo-bootstrap-flow` | Run step 0: resolve provider → create repo → write boilerplate → persist handle (pending — DoR blocker) |
| Data Model | `../tech-spec/data-model.md` | `#projects-table` | `projects.repo` handle columns (provider, repo_url, default_branch) (pending — DoR blocker) |

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| Generated output lives in a NEW external repo per project (GitHub/GitLab) | [build-engine.md B9 / FR-061](../../../build-engine.md#key-decisions) | This task creates the repo; TASK-008 pushes to it; nothing is generated inside Weave |
| Source control is a project/workspace setting, not a `PLAT-CONNECTOR-1` connector | [build-engine.md FR-061 / EPIC-002 E2-S6](../../../build-engine.md#21-functional-requirements) | Provider config via `PLAT-SETTINGS-1`; token in Secrets Manager; available at M1 (not connector-gated) |
| Rich scaffold (branch protection, full CI, harness) + env-verification gate is M2 | [build-engine.md FR-062 / E11-S6](../../../build-engine.md#21-functional-requirements) | M1 scope is create-repo + boilerplate + push enablement only |
| Fail-closed on unconfigured provider / invalid token | [build-engine.md FR-061](../../../build-engine.md#21-functional-requirements) | Run halts before PLAN; never falls back to a Weave-internal repo |
| Secrets: AWS Secrets Manager only | [CLAUDE.md](../../../../../../../CLAUDE.md#stack-confirmed) | Provider token fetched from Secrets Manager; never in response or logs |

## Test Requirements

### Unit Tests (minimum 4)

- `should raise RepoBootstrapError(repo_provider_unconfigured) when no provider is set`
- `should raise RepoBootstrapError(repo_auth_invalid) when the token is missing or the driver rejects auth`
- `should not include the provider token in any response body or log line`
- `should select the GitHub driver for provider=github and the GitLab driver for provider=gitlab`
- `should return existing repo handle without creating a second repo when project.repo already set`

### Integration Tests (minimum 2)

- `should create a repo (mocked provider), write the boilerplate initial commit, and persist project.repo`
- `should emit a PLAT-AUDIT-1 repo_bootstrapped event with provider and repo_url but no token`

### E2E Tests

N/A in M1 — repo bootstrap is a backend run step; covered by integration tests against a mocked provider.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Integration | `should create a repo (mocked provider), write the boilerplate initial commit, and persist project.repo` |
| AC-2 | Integration | `should create a repo (mocked provider), write the boilerplate initial commit, and persist project.repo` |
| AC-3 | Unit | `should return existing repo handle without creating a second repo when project.repo already set` |
| AC-4 | Unit | `should raise RepoBootstrapError(repo_provider_unconfigured) when no provider is set` |
| AC-5 | Unit | `should not include the provider token in any response body or log line` |
| AC-6 | Integration | `should emit a PLAT-AUDIT-1 repo_bootstrapped event with provider and repo_url but no token` |
| AC-7 | Unit | `should select the GitHub driver for provider=github and the GitLab driver for provider=gitlab` |

## Dependencies

- **blocked_by:** [TASK-001] — needs the project record (project IRI) and the source-control provider
  setting/token to be resolvable
- **unlocks:** [TASK-006, TASK-008] — TASK-006's run invokes `ensure_project_repo` as step 0;
  TASK-008 pushes generated output to `project.repo`
- **External prerequisites:** `"GitHub/GitLab provider token available via AWS Secrets Manager"`,
  `"Source-control provider setting resolvable via PLAT-SETTINGS-1"`

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~10k input, ~5k output
- **Estimated cost:** ~$0.55 (claude-fable-5 pricing at time of writing; verify in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (invoked internally by TASK-006 run start)
- [x] Design decisions noted
- [x] Dependencies defined
- [x] Cost estimate provided
- [ ] Tech-spec repo-bootstrap flow + `projects.repo` columns added (DoR blocker)

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Provider token never appears in any response or log
- [ ] Idempotent: a second run for the same project reuses the existing repo
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI) — rich scaffold/CI/gate is M2 (FR-062)
- [ ] PR references this task and EPIC-011

## Implementation Hints

- Model the two providers behind one `ScmDriver` interface (`create_repo`, `write_initial_commit`,
  `commit_workspace`) with `GitHubDriver` / `GitLabDriver` implementations selected by the provider
  setting — do not branch on provider strings throughout the code.
- The boilerplate/harness template should be a versioned template package (mirroring this repo's
  `.claude` + spec-driven setup) rendered with project variables; keep it separate from generation so
  the harness can evolve without touching the generation pipeline.
- Store the repo handle (`provider`, `repo_url`, `default_branch`, opaque `repo_id`) on the `projects`
  table so TASK-008's `git_client.commit_workspace(project.repo, ...)` needs no re-resolution.
- Treat `repo_provider_unconfigured` and `repo_auth_invalid` as run-halting errors surfaced on the run
  record (TASK-006), not silent skips — the whole point of B9 is that output never lands inside Weave.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
