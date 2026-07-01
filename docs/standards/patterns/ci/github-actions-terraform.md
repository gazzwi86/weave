---
type: Coding Standard
title: "CI — Terraform (github-actions)"
description: "Golden GitHub Actions workflow for Weave Terraform: fmt -check, init, validate, and plan on every PR (posted as a PR comment); apply on merge to main gated by a GitHub Environment with protection rules; all AWS access via OIDC assume-role (id-token: write) with least privilege — no plaintext credentials anywhere."
tags: [standards, patterns, ci, github-actions]
timestamp: 2026-07-01
resource: docs/standards/patterns/ci/github-actions-terraform.md
topic: ci
stack: github-actions
verification: "python3 yaml.safe_load PASS (valid YAML, 'jobs' key present); actionlint unavailable (no go/brew) — yaml-parse is the achieved level"
---

# CI — Terraform (github-actions)

## Intent

The CI/CD workflow for Weave infrastructure (Terraform, AWS backend). On every
pull request it must: check formatting (`terraform fmt -check`), `init` against
the remote backend, `validate`, and `plan` — with the plan saved and its human
summary posted back as a **PR comment** for review. The `plan` job assumes a
**read-only / plan-scoped** IAM role via OIDC. On merge to `main`, a separate
`apply` job runs, gated behind a **GitHub Environment** with protection rules
(required reviewers), assuming a **narrower apply-scoped** role via OIDC. There
are **no plaintext AWS credentials** — no `AWS_ACCESS_KEY_ID`, no `terraform.tfvars`
with secrets; state lives in the remote (S3 + DynamoDB lock) backend.

```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  pull_request:
    paths: ["infra/**", ".github/workflows/terraform.yml"]
  push:
    branches: [main]
    paths: ["infra/**", ".github/workflows/terraform.yml"]

permissions:
  contents: read

concurrency:
  # Serialise infra changes per ref — never two plans/applies racing on state.
  group: terraform-${{ github.ref }}
  cancel-in-progress: false

env:
  TF_VERSION: "1.9.5"
  TF_WORKING_DIR: infra

jobs:
  plan:
    name: fmt · validate · plan
    runs-on: ubuntu-latest
    # Gate the OIDC plan to first-party code: run on push to main, or on a PR raised
    # from a branch in THIS repo — never a fork PR (blocks the pwn-request / OIDC-token
    # and plan-comment-disclosure vectors from untrusted fork code).
    if: >-
      github.event_name == 'push' ||
      github.event.pull_request.head.repo.full_name == github.repository
    environment: dev            # plan role scoped to dev; protection rules apply
    permissions:
      id-token: write           # REQUIRED for OIDC assume-role
      contents: read
      pull-requests: write      # to post the plan summary comment
    defaults:
      run:
        working-directory: ${{ env.TF_WORKING_DIR }}
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1

      - uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555d616ced269862dd  # v3.1.2
        with:
          terraform_version: ${{ env.TF_VERSION }}

      # OIDC: short-lived creds for a PLAN-scoped (read-only) role. No secrets.
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@7474bc4690e29a8392af63c5b98e7449536d5c3a  # v4.3.1
        with:
          role-to-assume: ${{ vars.AWS_TF_PLAN_ROLE_ARN }}   # arn:aws:iam::<acct>:role/weave-tf-plan
          aws-region: ${{ vars.AWS_REGION }}
          role-session-name: gha-tf-plan-${{ github.run_id }}

      - name: Terraform fmt
        run: terraform fmt -check -recursive

      - name: Terraform init
        run: terraform init -input=false   # backend config via -backend-config or env

      - name: Terraform validate
        run: terraform validate -no-color

      - name: Terraform plan
        id: plan
        run: |
          terraform plan -input=false -no-color -lock-timeout=120s \
            -out=tfplan | tee plan.txt
        continue-on-error: true

      - name: Post plan summary to PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@f28e40c7f34bde8b3046d885e986cb6290c5673b  # v7.1.0
        with:
          script: |
            const fs = require('fs');
            const plan = fs.readFileSync('${{ env.TF_WORKING_DIR }}/plan.txt', 'utf8');
            const esc = plan.slice(0, 60000)
              .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const body = '### Terraform plan `${{ steps.plan.outcome }}`\n\n' +
              '<details><summary>Show plan</summary>\n\n<pre>' + esc + '</pre>\n</details>';
            await github.rest.issues.createComment({
              owner: context.repo.owner, repo: context.repo.repo,
              issue_number: context.issue.number, body,
            });

      - name: Fail if plan errored
        if: steps.plan.outcome == 'failure'
        run: exit 1

  apply:
    name: apply (gated)
    needs: plan
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment: production     # protection rules (required reviewers) gate apply
    permissions:
      id-token: write
      contents: read
    defaults:
      run:
        working-directory: ${{ env.TF_WORKING_DIR }}
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5  # v4.3.1

      - uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555d616ced269862dd  # v3.1.2
        with:
          terraform_version: ${{ env.TF_VERSION }}

      # Narrower APPLY-scoped role — distinct from the plan role.
      - name: Configure AWS credentials (OIDC)
        uses: aws-actions/configure-aws-credentials@7474bc4690e29a8392af63c5b98e7449536d5c3a  # v4.3.1
        with:
          role-to-assume: ${{ vars.AWS_TF_APPLY_ROLE_ARN }}   # arn:aws:iam::<acct>:role/weave-tf-apply
          aws-region: ${{ vars.AWS_REGION }}
          role-session-name: gha-tf-apply-${{ github.run_id }}

      - name: Terraform init
        run: terraform init -input=false

      - name: Terraform apply
        run: terraform apply -input=false -auto-approve -lock-timeout=120s
```

**Why:** `fmt -check`, `validate`, and `plan` run on every PR so infra changes are
reviewable before they touch anything. `continue-on-error` on `plan` lets the
comment step always post (success or failure), then an explicit gate fails the job
if the plan errored. `-lock-timeout` cooperates with the DynamoDB state lock;
`concurrency` with `cancel-in-progress: false` serialises runs so a plan/apply is
never interrupted mid-state-write. `apply` is a distinct job that only runs on
push to `main` and only after the `production` environment's protection rules pass.

**Plan/apply are separate runs by design.** The PR `plan` and the post-merge
`apply` are distinct workflow runs (`pull_request` vs `push`), so `apply`
intentionally re-plans against current `main` (`init` + `apply`) rather than
consuming the PR's binary `tfplan` — the human approval gate on the `production`
environment (required reviewers), not a saved artifact, is the safety control.
The reviewer approves the *change*; `apply` then re-derives it on the merged tree,
which also catches drift merged in between. Note `-out=tfplan` writes a binary plan
that nothing here consumes — the PR comment is built from `plan.txt` (the `tee`
capture) and apply re-plans — so if you require the *exact* reviewed plan to be the
one applied, upload `tfplan` as an artifact and `terraform apply tfplan` in a
same-run gated job instead.

**Security:**
- **OIDC, not static keys.** Both jobs use `configure-aws-credentials@v4` to
  exchange the OIDC token for a short-lived STS session — no
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` secret exists. Matches Weave's "AWS
  Secrets Manager only; machine auth = IAM role via STS" rule.
- **Split plan vs apply roles, least privilege.** `AWS_TF_PLAN_ROLE_ARN` is
  read-only (plan/describe); `AWS_TF_APPLY_ROLE_ARN` has the mutate permissions.
  Each role's trust policy restricts `token.actions.githubusercontent.com:sub` to
  the matching `repo:<org>/<repo>:environment:<dev|production>` — the apply role
  is only assumable from the protected `production` environment.
- **Environment protection gates apply.** `environment: production` enforces
  required reviewers / branch restrictions / wait timers before `terraform apply`
  runs — the human approval gate, plus the `main`-branch + `push` guard.
- **No plaintext creds or state on disk.** Remote backend (S3 + DynamoDB lock);
  no `terraform.tfvars` with secrets, no `AWS_*` env secrets. `plan.txt` is
  ephemeral and truncated in the comment.
- **`id-token: write` scoped per job**; workflow default is `contents: read`;
  `pull-requests: write` is granted only to the plan job for its comment.
- **Plan gated to first-party PRs.** The plan job's `if` runs it on push to `main`
  or on a PR from a branch in this repo, never a fork PR — so untrusted fork code
  can neither assume the OIDC plan role (pwn-request) nor trigger a plan comment.
  Note the plan text can still carry confidential-but-non-sensitive values
  (endpoints, ARNs, generated names): Terraform redacts `sensitive` values but not
  these, so keep infra repos private and the comment first-party-only.
- **SHA-pinned actions.** Every third-party `uses:` is pinned to a full 40-char
  commit SHA with a trailing `# vX.Y` comment — mandatory because these jobs hold
  `id-token: write`, so a re-tagged/compromised action could otherwise mint AWS STS
  credentials (tj-actions/changed-files, Mar 2025). renovate/dependabot bumps the
  SHAs; `TF_VERSION` is pinned, not `latest`.

**Anti-patterns:**
- `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` as secrets, or committed
  `terraform.tfvars` with credentials — forbidden; use OIDC + Secrets Manager.
- Running `apply` on pull_request, or without an `environment:` gate — removes the
  review/approval barrier.
- One all-powerful role for both plan and apply — split them; plan is read-only.
- `terraform apply -auto-approve` reached directly on PR without a reviewed plan.
- Local/committed state, or omitting the state lock (`-lock-timeout`) — risks
  corruption and lost audit trail.
- `cancel-in-progress: true` on infra — can interrupt an in-flight apply and leave
  state locked/partial.
- Skipping `fmt -check`/`validate`, or adding `|| true` to them — soft gates.
