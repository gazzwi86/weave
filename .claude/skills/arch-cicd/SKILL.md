---
name: arch-cicd
description: Produce the CI/CD pipeline spec (ci-cd.md) for a Weave entity, covering the full GitHub Actions workflow from lint to production deploy. Invoked during the architect phase when a CI/CD design is needed for a new or updated service.
---

# arch-cicd Skill

Produce the CI/CD pipeline spec (`ci-cd.md`) for a Weave entity, covering the full
GitHub Actions workflow from lint to production deployment. Invoked as part of the
architect phase (04-arch) when a CI/CD design is needed for a new or updated service.

## Model

- **All phases:** claude-sonnet-4-6 (structured generation, precise YAML, diagram output)

No Opus tier needed — this is specification drafting with well-defined inputs, not
open-ended elicitation. If the entity has unusual constraints (novel runtime, bespoke
cloud provider) escalate to Opus via the `/architect` skill instead.

## Input

Before writing anything, read:

1. `CLAUDE.md` — confirmed stack (GitHub Actions + OIDC to AWS is the default; no
   alternatives unless the user explicitly states otherwise)
2. `.claude/spec-templates/tech-spec/ci-cd.md` — section scaffold and table formats
3. **Project type detection** — determine which stack(s) are present:
   - Python service → read `.claude/spec-templates/few-shot/ci/github-actions-python-uv.md`
   - TypeScript / Next.js → read `.claude/spec-templates/few-shot/ci/github-actions-ts-monorepo.md`
   - Mixed monorepo → read both
4. Any existing tech spec for this entity
   (`docs/specs/<entity>/04-arch/tech-spec/*.md`) to understand service boundaries,
   deployed artefacts, and infrastructure targets
5. Ask the user which entity this spec is for if not supplied; output path is:
   `docs/specs/<entity>/04-arch/tech-spec/ci-cd.md`

## Instructions

### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs a CI/CD spec before writing
anything else.

Example: "A CI/CD spec's job is to make the path from code change to production
deployment deterministic and auditable. If a reviewer reads it and cannot identify
exactly which human action is required before production, the spec has failed. Every
stage must have a single, unambiguous trigger and a single, unambiguous failure action."

Reference this principle when justifying decisions during the HITL loop.

### Step 1 — Context ingestion

1. Read all inputs listed above.
2. Determine the project type(s): Python, TypeScript, or mixed.
3. Identify the deployed artefact types: Lambda function, ECS Fargate service, S3 static
   site, or combination.
4. Summarise in 3 bullets before writing the first section:
   - What services/artefacts are being deployed
   - Which stack(s) are in scope (Python / TypeScript / mixed)
   - What infrastructure targets exist (Lambda, Fargate, CloudFront+S3, etc.)

Ask via AskUserQuestion:
- "Do you have any overrides to the default CI/CD stack (GitHub Actions + OIDC to AWS)?"
  Options: No overrides / I have specific environment URLs / I have non-standard stages /
  I need to explain something first

### Step 2 — Section-by-section production

Produce the spec in this exact order. For each section:

1. **Write** the section to the file at `docs/specs/<entity>/04-arch/tech-spec/ci-cd.md`
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated
3. **Present** the section to the user (display the written content)
4. **Emit a confidence block** (see below) immediately before the HITL question
5. **Ask** via AskUserQuestion: Approve / Amend / Reject
6. If Amend: apply changes, show diff, re-present with updated confidence block
7. If Reject: regenerate with a cleaner approach, show the new version

**HITL is mandatory after the Pipeline Overview diagram and after the Workflow YAML draft.**

---

#### Section 1 — Pipeline Overview (Mermaid flowchart)

Produce a `mermaid` `flowchart LR` diagram showing:

- CI sub-graph (triggered on pull_request): lint → typecheck → unit tests →
  integration tests → build
- CD sub-graph (triggered on push to main): dev deploy → staging deploy →
  manual gate → production deploy
- Rollback arrows from failed smoke tests back to an alert/rollback node
- Label each arrow with its trigger condition

**HITL required after this section.** Do not proceed to Section 2 until the diagram
is approved.

Rules for the diagram:
- Subgraph labels must match: `CI (on pull_request)` and `CD (on push to main)`
- Manual gate node must be shaped as a decision diamond `{Manual Approval}`
- Rollback nodes must be labelled `[Rollback + Alert]`
- No `{{PLACEHOLDER}}` text in the diagram

---

#### Section 2 — CI Stages table

Produce a table with columns: `Stage | Tool | Command | Failure Action`

**Python services** (use `uv` — this is Weave's confirmed Python toolchain):

| Stage | Tool | Command | Failure Action |
|---|---|---|---|
| Lint | Ruff | `uv run ruff check . --output-format=github` | Block merge |
| Format | Ruff | `uv run ruff format --check .` | Block merge |
| Type check | mypy | `uv run mypy src --strict` | Block merge |
| Unit tests | pytest + pytest-cov | `uv run pytest --cov=src --cov-fail-under=80 -v` | Block merge |
| Integration tests | pytest | `uv run pytest tests/integration -v` | Block merge |
| Build / package | uv build | `uv build` | Block merge |

**TypeScript / Next.js services** (use pnpm + Turbo):

| Stage | Tool | Command | Failure Action |
|---|---|---|---|
| Lint | ESLint | `pnpm turbo lint --filter="...[HEAD^1]"` | Block merge |
| Type check | TypeScript | `pnpm turbo typecheck --filter="...[HEAD^1]"` | Block merge |
| Unit tests | Vitest | `pnpm turbo test --filter="...[HEAD^1]"` | Block merge |
| Integration tests | Playwright | `pnpm turbo test:e2e --filter="...[HEAD^1]"` | Block merge |
| Build | Next.js | `pnpm turbo build` | Block merge |

For mixed monorepos, produce both tables separated by a sub-heading.

Include a **Quality Gates** sub-section (bulleted) listing hard numeric thresholds:
- Test coverage ≥ 80% (enforced via `--cov-fail-under=80` / `--coverage-threshold`)
- Cyclomatic complexity ≤ 10 per function (Law E)
- Cognitive complexity ≤ 15 per function (Law E)
- Function length ≤ 50 lines (Law E)
- Zero high/critical security vulnerabilities (`pip-audit` / `npm audit`)

---

#### Section 3 — CD Stages table

Produce a table with columns:
`Stage | Trigger | Target Environment | Gate | Rollback`

Populate with exactly three CD stages following Weave's confirmed environment model:

| Stage | Trigger | Target | Gate | Rollback |
|---|---|---|---|---|
| Deploy to Dev | Merge to `main` (CI passes) | dev | Automatic | Auto-rollback on smoke fail |
| Deploy to Staging | Dev smoke tests pass | staging | Automatic | Auto-rollback on smoke fail |
| Deploy to Production | Staging smoke pass + manual approval | production | **Manual approval required** | Auto-rollback on smoke fail |

Notes to include:
- Dev deploys automatically on every merge to `main` — no human action required
- Staging deploys automatically after dev smoke tests pass
- Production requires explicit approval in the GitHub environment protection rules
- Smoke tests run as a separate job after each deploy job, gating promotion

---

#### Section 4 — GitHub Actions Workflow YAML (draft)

Generate the full workflow YAML at `.github/workflows/ci-cd.yml`.

**Security rule (non-negotiable):** Use OIDC token exchange for AWS credentials.
No `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in GitHub Secrets. The correct
pattern is:

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ vars.AWS_DEPLOY_ROLE_ARN }}
    aws-region: ${{ vars.AWS_REGION }}
```

**For Python services**, base the CI job on the few-shot at
`.claude/spec-templates/few-shot/ci/github-actions-python-uv.md`:
- `astral-sh/setup-uv@v4` with `enable-cache: true` and `cache-dependency-glob: "uv.lock"`
- `uv sync --frozen --all-extras`
- Python matrix: `["3.11", "3.12"]`
- Coverage artifact upload (3.12 only), coverage comment job on PRs

**For TypeScript services**, base the CI job on the few-shot at
`.claude/spec-templates/few-shot/ci/github-actions-ts-monorepo.md`:
- `pnpm/action-setup@v4` with version 9
- `pnpm install --frozen-lockfile`
- Node matrix: `["20", "22"]`
- `TURBO_TOKEN` / `TURBO_TEAM` for remote cache
- `--filter="...[HEAD^1]"` for affected-only runs on PRs

**Mandatory structural elements in the YAML:**

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

```yaml
permissions:
  id-token: write   # required for OIDC
  contents: read
```

CD jobs must use GitHub Environments:
```yaml
environment:
  name: production
  url: ${{ steps.deploy.outputs.url }}
```

**HITL required after this section.** Do not proceed to Section 5 until the YAML
draft is approved.

Do not leave `{{PLACEHOLDER}}` in the YAML. Use `${{ vars.VAR_NAME }}` for
environment-specific values and add a comment explaining what each variable holds.

---

#### Section 5 — Branch Strategy and Protection Rules

Produce two sub-sections:

**Branch Strategy** — a short table:

| Branch | Purpose | Merge strategy | Delete on merge |
|---|---|---|---|
| `main` | Single deployable trunk | Squash merge | N/A |
| `feature/<ticket>` | Feature development | Squash → main | Yes |
| `hotfix/<ticket>` | Production hotfixes | Squash → main | Yes |
| `release/<version>` | Release candidate (if used) | Merge commit | No |

**Protection Rules** — bulleted list for `main`:

- Require pull request reviews: minimum 1 approval
- Dismiss stale reviews when new commits are pushed
- Require status checks to pass before merging (list each CI job by name)
- Require branches to be up to date before merging
- Require signed commits
- Do not allow force pushes
- Do not allow deletions
- Restrict pushes to `main` to repository admins only

Include a note: "Configure these rules in GitHub → Repository Settings → Branches →
Branch protection rules. The GitHub Actions environments (dev / staging / production)
are configured in Settings → Environments."

---

### After all sections approved

1. Ensure the file has the correct frontmatter (see Output section).
2. Remove any remaining `{{PLACEHOLDER}}` text — replace with `TBD: <description>` if
   genuinely unknown, and add a `<!-- TODO: replace before scaffolding -->` comment.
3. Commit the spec:

```bash
git add docs/specs/<entity>/04-arch/tech-spec/ci-cd.md
git commit -m "docs(<entity>): add CI/CD pipeline spec"
```

4. Tell the user: "CI/CD spec complete. Next steps:
   - `/architect` continues with remaining tech-spec sections, or
   - Run `/implement` to scaffold `.github/workflows/ci-cd.yml` from this spec."

## Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (functional, automation-tested): complied | violated | N/A — <reason>
Plugin Law C (council-graded quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (synthetic verification only): complied | violated | N/A — <reason>
CI/CD Law 1 (OIDC only — no long-lived AWS credentials): complied | violated | N/A — <reason>
CI/CD Law 2 (uv for Python deps — never bare pip): complied | violated | N/A — <reason>
CI/CD Law 3 (manual gate on production): complied | violated | N/A — <reason>
CI/CD Law 4 (coverage threshold enforced in pipeline): complied | violated | N/A — <reason>
CI/CD Law 5 (no placeholder text in delivered YAML): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

## Confidence block (emit before every HITL question)

Output this block immediately after presenting the section, before the AskUserQuestion
call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific node, job, table row, or YAML block>
Why: <1 sentence — what input was missing or what you assumed>
</section-confidence>
```

Rules:
- Always name the weakest part, even on high-confidence sections.
- "Why" must reference a specific input gap, not a generic hedge.
- The block lives in chat only — do not embed it in the file.

## Output

File: `docs/specs/<entity>/04-arch/tech-spec/ci-cd.md`

Template: `.claude/spec-templates/tech-spec/ci-cd.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.

Frontmatter:

```yaml
---
type: CI/CD Spec
title: "CI/CD Pipeline Spec: <entity display name>"
description: "<one-line summary of the CI/CD pipeline for this entity>"
tags: [<entity>, 04-arch]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: Draft
created: <YYYY-MM-DD>
entity: <entity>
stack: <python | typescript | mixed>
---
```

The companion workflow file (`.github/workflows/ci-cd.yml`) is written as a draft
in the spec but is not committed to `.github/` until the `/implement` skill scaffolds
it. Include it in the spec as a fenced `yaml` code block only.

## Evaluation Criteria

A well-produced CI/CD spec:

- Has a Mermaid flowchart that shows all five CI stages and all three CD environments
  with explicit trigger labels and rollback paths
- Uses OIDC credential exchange — `aws-actions/configure-aws-credentials@v4` with
  `role-to-assume` — and no long-lived AWS secrets
- Python jobs use `astral-sh/setup-uv@v4` with lockfile caching; TypeScript jobs use
  `pnpm/action-setup@v4` with Turbo affected-only filtering
- Production deployment job is gated by a GitHub Environment with manual approval;
  dev and staging are automatic
- Coverage threshold of ≥ 80% is enforced as a pipeline failure condition (not just a
  warning)
- Concurrency group with `cancel-in-progress: true` is present on all workflow triggers
- Branch protection rules are enumerated for `main` and reference the exact CI job
  names that must pass
- No `{{PLACEHOLDER}}` text remains — all environment-specific values use
  `${{ vars.VAR_NAME }}` with an explanatory comment
- Was delivered section-by-section with HITL after the diagram and after the YAML draft
- Constitutional self-check trace present in chat for every section
