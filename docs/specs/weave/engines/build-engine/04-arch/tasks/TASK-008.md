---
type: Task
title: "Task: TASK-008 — App Generation & M1 Safety Gates (E8-S1)"
description: "Generate a Next.js + FastAPI application from an approved spec grounded in CE-READ-1, and run the M1 safety gates (SAST, type-check, mutation ≥70%, pkg-existence, secret-scan) atomically before any commit."
tags: [build-engine, 04-arch, task, m1]
status: Backlog
priority: Must Have
entity: build-engine
epic: EPIC-008
milestone: M1
created: 2026-07-01
blocked_by: [TASK-006]
unlocks: [TASK-009]
adr_refs: []
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: 61dfc1553b18b5762902e1d2b3681c82f4ebb26c
expires_on: 2026-12-28
owner: gazzwi86
coverage: n/a
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/build-engine/04-arch/tasks/TASK-008.md
---

# Task: TASK-008 — App Generation & M1 Safety Gates (E8-S1)

## Story

**Epic:** [EPIC-008 — Artefact Generation](../../../build-engine.md#epic-008--artefact-generation)
**Status:** Backlog
**Priority:** Must Have

**As a** dark-factory Engineer agent
**I want** to generate a working Next.js + FastAPI application from an approved spec and pass
all M1 safety gates before a single file is committed
**So that** every generated application meets minimum quality standards and never introduces
security vulnerabilities or plaintext secrets into the codebase

> **FRs covered:** FR-029 (M1 safety gates: SAST/type/mutation ≥70%/pkg-existence/secret-scan —
> atomic; any failure = nothing committed). CE-BRAND-1 conformance gate is explicitly **out of
> scope — M2** (see build-engine.md decision B7; formula in contracts.md §CE-BRAND-1). App
> generation covers only E8-S1; agent gen (E8-S2) is post-v1, anatomy (E8-S3) is M2.

## Acceptance Criteria

| ID | Criterion (EARS) | Test Mapping |
|---|---|---|
| AC-1 | WHEN the Engineer agent generates an application, THE SYSTEM SHALL ground the generation in the BPMO project graph via `CE-READ-1` (pinned version from `project.pinned_version_iri`); WHEN `CE-READ-1` is unreachable, THE SYSTEM SHALL halt generation and return `503 {"error": "ce_read_unavailable"}` — generation never proceeds without graph context | `test_generation_halts_503_when_ce_read_unavailable` |
| AC-2 | WHEN code is generated, THE SYSTEM SHALL produce: OpenAPI 3.1 spec → FastAPI routes and Pydantic models → Next.js 15 App Router pages and shadcn/ui components; the output structure MUST match the project's entity types from the BPMO graph | `test_generation_produces_openapi_fastapi_nextjs_structure` |
| AC-3 | WHEN the M1 safety gate pipeline runs, THE SYSTEM SHALL execute all five gates in this order: (1) secret-scan, (2) SAST (Bandit for Python, Semgrep for all), (3) type-check (mypy --strict for Python, tsc --noEmit for TypeScript), (4) package-existence (each import resolvable), (5) delta-scoped mutation ≥ 70%; the pipeline is ATOMIC — if any gate fails, nothing is committed | `test_safety_gates_atomic_nothing_committed_on_any_failure` |
| AC-4 | WHEN the secret-scan gate detects a plaintext secret (regex patterns for API keys, passwords, connection strings), THE SYSTEM SHALL halt the pipeline immediately, return the file path and line number, and emit `PLAT-AUDIT-1` event `"secret_scan_fail"` — no downstream gates run | `test_secret_scan_halts_pipeline_with_file_and_line` |
| AC-5 | WHEN the mutation gate runs, THE SYSTEM SHALL compute mutation score only on delta (changed files in this generation run) and FAIL the gate when score is < 70%; the specific surviving mutants MUST be included in the failure evidence | `test_mutation_gate_fails_below_70_percent_with_evidence` |
| AC-6 | WHEN all five M1 safety gates pass, THE SYSTEM SHALL commit the generated code to a feature branch with a conventional commit message (`feat(<entity>): generate <artefact-name>`) and return `201` with `{commit_sha, branch, gates_passed: [...]}` | `test_all_gates_pass_commits_to_feature_branch` |
| AC-7 | WHEN generated configuration or code references Claude model IDs, THE SYSTEM SHALL use only the confirmed set (`claude-opus-4-8`, `claude-sonnet-5`, `claude-haiku-4-5`); any placeholder or invented model ID MUST cause a SAST-pattern violation that fails the pipeline | `test_generated_code_uses_only_confirmed_model_ids` |
| AC-8 | WHEN the CE-BRAND-1 conformance gate is referenced anywhere in the M1 generation pipeline, THE SYSTEM SHALL treat it as NOT APPLICABLE for M1 and not run it; the gate result for CE-BRAND-1 MUST NOT appear in the M1 gate summary | `test_brand_gate_not_run_in_m1` |

## Implementation

### Pseudocode

```
function generate_app(jwt, project_iri, task_id):
  claims = cognito.verify(jwt)        # → 401
  project = aurora.get_project(project_iri, tenant=claims.tenant_id)
  if not project: return 404 with {"error": "not_found"}
  brief = aurora.get_brief(task_id, tenant=claims.tenant_id)
  if not brief: return 404 with {"error": "brief_not_found"}

  # Ground in CE-READ-1 (non-degradable for generation)
  try:
    bpmo = ce_read_client.get(
      f"/api/sparql?version={project.pinned_version_iri}&...",
      sparql=GENERATION_GROUNDING_QUERY
    )
  except ConnectionError:
    return 503 with {"error": "ce_read_unavailable"}

  # DELEGATE: Engineer agent generates artefacts to a temp working dir
  workspace = tempfile.mkdtemp(prefix=f"build-{task_id}-")
  engineer_agent.run(
    model="claude-sonnet-5",
    prompt=build_generation_prompt(brief, bpmo),
    output_dir=workspace
  )
  # workspace contains: openapi.yaml, backend/ (FastAPI), frontend/ (Next.js 15)

  # M1 Safety gates — atomic; first failure aborts
  gate_results = []

  # Gate 1: Secret scan (runs first — cheapest; fail-fast on worst-case risk)
  secret_hits = secret_scanner.scan(workspace)     # regex patterns for common secret shapes
  if secret_hits:
    emit_audit("secret_scan_fail", actor=BUILD_PRINCIPAL, target=task_id,
               diff_summary={"hits": secret_hits})
    return 422 with {"error": "secret_scan_fail", "hits": secret_hits}
  gate_results.append({"gate": "secret_scan", "status": "PASS"})

  # Gate 2: SAST (Bandit for .py, Semgrep for all)
  bandit_result = subprocess.run(["bandit", "-r", workspace, "-ll"], capture_output=True)
  semgrep_result = subprocess.run(["semgrep", "--config=auto", workspace], capture_output=True)
  if bandit_result.returncode != 0 or semgrep_result.returncode != 0:
    shutil.rmtree(workspace)
    return 422 with {"error": "sast_fail", "evidence": bandit_result.stderr.decode() +
                                                         semgrep_result.stderr.decode()}
  gate_results.append({"gate": "sast", "status": "PASS"})

  # Gate 3: Type check
  mypy_result = subprocess.run(["mypy", f"{workspace}/backend", "--strict"], capture_output=True)
  tsc_result = subprocess.run(["tsc", "--noEmit", "--project", f"{workspace}/frontend"],
                               capture_output=True)
  if mypy_result.returncode != 0 or tsc_result.returncode != 0:
    shutil.rmtree(workspace)
    return 422 with {"error": "type_check_fail", "evidence": mypy_result.stderr.decode() +
                                                               tsc_result.stderr.decode()}
  gate_results.append({"gate": "type_check", "status": "PASS"})

  # Gate 4: Package existence (each import resolvable)
  unresolved = package_checker.check(workspace)   # parse imports, check against lock file
  if unresolved:
    shutil.rmtree(workspace)
    return 422 with {"error": "package_existence_fail", "unresolved": unresolved}
  gate_results.append({"gate": "package_existence", "status": "PASS"})

  # Gate 5: Delta-scoped mutation ≥ 70%
  mutation_result = mutmut.run_delta(workspace)    # only changed files
  if mutation_result.score < 0.70:
    shutil.rmtree(workspace)
    return 422 with {"error": "mutation_gate_fail", "score": mutation_result.score,
                     "surviving_mutants": mutation_result.survivors}
  gate_results.append({"gate": "mutation", "status": "PASS", "score": mutation_result.score})

  # All gates passed — commit to feature branch
  branch = f"build/{project_iri.split(':')[-1]}/{task_id}"
  commit_sha = git_client.commit_workspace(workspace, branch,
    message=f"feat({project.entity}): generate {brief.title}")
  shutil.rmtree(workspace)

  emit_audit("generation_complete", actor=BUILD_PRINCIPAL, target=task_id,
             diff_summary={"commit_sha": commit_sha, "branch": branch, "gates": gate_results})

  return 201 with {"commit_sha": commit_sha, "branch": branch, "gates_passed": gate_results}
```

### API Contracts

**`POST /api/projects/{project_iri}/tasks/{task_id}/generate`**

Request body:

```json
{}
```

(No body required — project and task context loaded from URL path and DB.)

Response `201` (all gates passed):

```json
{
  "commit_sha": "string — git commit SHA",
  "branch": "string — feature branch name",
  "gates_passed": [
    { "gate": "string — secret_scan | sast | type_check | package_existence | mutation", "status": "PASS" }
  ]
}
```

Response `422` (any gate failed):

```json
{
  "error": "string — secret_scan_fail | sast_fail | type_check_fail | package_existence_fail | mutation_gate_fail",
  "evidence": "string | null — truncated stderr or finding detail",
  "hits": ["object — present for secret_scan_fail"],
  "surviving_mutants": ["object — present for mutation_gate_fail"],
  "score": "number | null — present for mutation_gate_fail"
}
```

Error responses:

| Status | Condition | Body |
|---|---|---|
| 401 | Missing or invalid JWT | `{"error": "unauthorised"}` + `Www-Authenticate: Bearer` |
| 404 | Project or task brief not found | `{"error": "not_found"}` |
| 422 | Any M1 safety gate failure (nothing committed) | See above |
| 503 | `CE-READ-1` unreachable | `{"error": "ce_read_unavailable"}` |

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---|---|---|---|
| Sequence | `../tech-spec/business-process.md` | `#app-generation-pipeline` | OpenAPI→FastAPI→Next.js generation pipeline with 5 safety gates |
| State | `../tech-spec/business-process.md` | `#gate-flow` | Gate-flow diagram (also in build-engine.md §4) showing SAFETY gate position |
| Data Model | `../tech-spec/data-model.md` | `#generation-runs-table` | `generation_runs` table tracking gate results, branch, commit SHA |

All three are pending tech-spec additions (DoR blockers).

### Design Decisions

| Decision | Reference | Impact on This Task |
|---|---|---|
| M1 safety gates: SAST/type/mutation ≥70%/pkg-existence/secret-scan — atomic | [build-engine.md FR-029](../../../build-engine.md#21-functional-requirements) | Gates run in the order stated (secret-scan first, mutation last); any failure returns 422 and cleans up workspace |
| CE-BRAND-1 conformance gate is M2 (not M1) | [build-engine.md decision B7](../../../build-engine.md#key-decisions) + [contracts.md §CE-BRAND-1](../../../../contracts.md#ce-brand-1) | Do NOT call `GET /api/brand/tokens` or `GET /api/brand/voice-rules` in M1 generation; gate result must not appear in M1 gate summary |
| Engineer agent model: `claude-sonnet-5` | [CLAUDE.md](../../../../../../../CLAUDE.md#stack-confirmed) | Hardcoded in routing table; generation uses Sonnet (speed/cost balance); Opus is advisor role only |
| Generation grounds in CE-READ-1 (non-degradable) | [build-engine.md FR-002](../../../build-engine.md#21-functional-requirements) | CE-READ-1 unreachable → 503; no degraded generation mode for the generate endpoint (unlike spec-drafting) |
| Mutation is delta-scoped (changed files only) | [build-engine.md FR-029](../../../build-engine.md#21-functional-requirements) | `mutmut run --use-coverage` on changed files; full-codebase mutation is M2+ |
| Commit to feature branch (not directly to main) | No ADR yet — decision here | `build/{entity}/{task_id}` branch naming; merge to main is a human step (no autonomous merge — decision B4) |

## Test Requirements

### Unit Tests (minimum 5)

- `should return 503 when CE-READ-1 raises ConnectionError before generation starts`
- `should return 422 with secret_scan_fail when secret regex matches in generated file`
- `should return 422 with sast_fail when bandit exits non-zero`
- `should return 422 with mutation_gate_fail when mutation score is 0.65`
- `should include surviving_mutants in mutation_gate_fail response`
- `should not call CE-BRAND-1 endpoints in M1 gate pipeline`

### Integration Tests (minimum 3)

- `should commit to feature branch and return commit_sha when all gates pass`
- `should clean up workspace directory when any gate fails`
- `should record generation_complete audit event on success`

### E2E Tests

N/A — generation is a backend pipeline in M1; covered by integration tests.

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|---|---|---|
| AC-1 | Unit | `should return 503 when CE-READ-1 raises ConnectionError before generation starts` |
| AC-2 | Integration | `should commit to feature branch and return commit_sha when all gates pass` |
| AC-3 | Unit | `should return 422 with sast_fail when bandit exits non-zero` |
| AC-4 | Unit | `should return 422 with secret_scan_fail when secret regex matches in generated file` |
| AC-5 | Unit | `should return 422 with mutation_gate_fail when mutation score is 0.65` |
| AC-6 | Integration | `should commit to feature branch and return commit_sha when all gates pass` |
| AC-7 | Unit | `should not call CE-BRAND-1 endpoints in M1 gate pipeline` |
| AC-8 | Unit | `should not call CE-BRAND-1 endpoints in M1 gate pipeline` |

## Dependencies

- **blocked_by:** [TASK-006]
- **unlocks:** [TASK-009]
- **External prerequisites:** `"Bandit, Semgrep, mypy, tsc, mutmut available in agent execution environment"`, `"Git credentials for feature branch push available via Secrets Manager"`, `"CE-READ-1 endpoint available"`

## Cost Estimate

- **Complexity:** L
- **Estimated tokens:** ~15k input, ~8k output
- **Estimated cost:** ~$1.10 (claude-opus-4-8 pricing at time of writing; verify in MEMORY.md)

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined
- [x] Diagram references included (3 pending — DoR blockers for tech-spec pass)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined
- [x] Cost estimate provided
- [ ] Tech-spec generation pipeline and gate-flow diagrams created (DoR blockers)

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] Docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and EPIC-008

## Implementation Hints

- Use `tempfile.mkdtemp()` for the workspace and wrap the entire generation+gate pipeline in
  a `try/finally` block with `shutil.rmtree(workspace)` in the `finally` — leaking temp
  directories is a security risk in a multi-tenant environment.
- The secret-scan regex patterns should cover: `(api|secret|password|token|key)\s*[:=]\s*["'][^"']{8,}`,
  AWS access key patterns (`AKIA[0-9A-Z]{16}`), and common connection string formats; load
  from a config file (not hardcoded in the scanner) so they can be extended without code changes.
- The SAST gate runs two tools (Bandit + Semgrep) — both must exit 0; either failure fails the
  gate. Capture their stderr separately in the evidence field for actionable error messages.
- `package_checker.check()` should parse `import` and `from ... import` statements in all
  `.py` files and `import`/`require` in `.ts`/`.tsx` files, then cross-reference against the
  uv lockfile and npm `package-lock.json`; any unresolvable package name is a hard block.
- The CE-BRAND-1 guard (AC-8) should be an explicit assertion in the gate runner's test:
  `mock.assert_not_called()` on `ce_read_client.get("/api/brand/tokens")` — document it as
  intentional so a future developer does not inadvertently remove the guard.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
