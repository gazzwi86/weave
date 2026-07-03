# PLAT-TASK-001: Monorepo scaffold, IaC, CI/CD pipeline

Branch: `feature/PLAT-EPIC-000`. Builds on PR #9 (backend FastAPI health
endpoint, frontend Next.js scaffold, root Makefile/package.json, base
`ci.yml` with api/web/semgrep jobs).

## What this task added

- `make scaffold` (idempotent monorepo dir creation + re-lint), `make up`/`make down`.
- `packages/shared` — placeholder only (no consumers yet, no build tooling; YAGNI).
- `infra/terraform/` — essential modules (cognito, secrets, s3_state,
  dynamo_lock) always applied; prod-gated modules (vpc, aurora_pg,
  elasticache, s3_assets, s3_spa, cloudfront) behind `deploy_prod_stack`
  via `count`. Single `environments/dev` root; staging/prod are
  tfvars-only placeholders per the brief's layout.
- `docker-compose.yml` + `seed/` — local-first stack (postgres, redis,
  localstack, ollama, oxigraph) with seed data. Verified with a real
  `docker compose up` run, not just structural review.
- CI extensions: `mutation` (mutmut + 70% gate), `secrets` (gitleaks,
  direct binary, pinned version), `deploy-essential-dev` (OIDC-only,
  no-ops until a human sets `vars.DEPLOY_ROLE_ARN`).

## Decisions / deviations from the brief

1. **Cognito token validity is not 60s (ADR-001).** The brief specified
   60s for access/ID/refresh tokens. `terraform plan` (run offline)
   rejects this at plan time — AWS enforces a 5m floor for access/ID
   tokens and a 1h floor for refresh tokens; 60s isn't a legal value for
   either. Used AWS's own minimums (300s / 3600s) instead, with
   Terraform `validation` blocks so an illegal value fails fast in the
   future. See `docs/specs/weave/engines/weave-platform/decisions/ADR-001.md`.
2. **ElastiCache `engine_version` needed the `<major>.<minor>` format**
   (`"7"` is rejected by the provider for Redis 6+; used `"7.1"`).
   Small, non-architectural fix, no ADR needed.
3. **oxigraph has no Docker-native healthcheck.** Its official image
   (`ghcr.io/oxigraph/oxigraph`) is a single static binary with no
   shell/curl — confirmed via `docker inspect` and
   `docker run --entrypoint sh`, so a `HEALTHCHECK`/compose `healthcheck:`
   exec-based check is impossible for it. Its readiness *and* seed-load
   confirmation are instead folded into one host-side poll
   (`_oxigraph_seeded()` in `test_local_stack.py`) that queries the
   SPARQL ASK endpoint — it only returns true once the `oxigraph-seed`
   loader container has PUT the seed triples in. `SERVICES` (the tuple
   checked via `docker compose ps` Health) covers the other 4 services
   only.
4. **postgres uses `POSTGRES_HOST_AUTH_METHOD=trust`, not a password.**
   Loopback-only, ephemeral, local-dev-only container — avoids putting
   any password-shaped literal in a committed file (gitleaks/bandit
   noise) for a container that never holds anything real. Real
   environments use Aurora + Secrets Manager (`infra/terraform/modules/secrets`).
5. **Offline `terraform plan` needs a local-backend override.** The dev
   environment's real backend is `s3`; `terraform plan` (unlike
   `validate`) demands a working backend even with dummy credentials, so
   `-backend=false` alone isn't enough. `test_terraform_plan.py` writes a
   git-ignored `override.tf` (`backend "local" {}`) for the duration of
   the offline plan, then removes it — Terraform's own documented
   mechanism for this exact situation.
6. **The OIDC deploy role is not Terraform-managed.** Chicken-and-egg:
   the role that lets CI authenticate needs to exist before CI can
   authenticate. Documented the required IAM trust-policy shape
   (`repo:gazzwi86/weave:ref:refs/heads/main`) in
   `infra/terraform/README.md` for a human to provision out-of-band
   before setting the `DEPLOY_ROLE_ARN` repo variable — this is the HITL
   gate for the very first real deploy.
7. **Mutation gate: initially "passed structurally" (0 checked), but
   real `mutmut run` after adding capsys/boundary tests to
   `test_mutation_gate.py` produces a genuinely graded 90.7% (39/43
   killed).** The very first version of these tests scored only 67.4%
   (would have failed the CI gate for real) — missing-key defaults,
   exact-threshold boundaries, and printed-message content weren't
   exercised. Fixed by strengthening the tests, not by loosening the gate.

## Known limitation carried over (not re-litigated this session)

`main()` in `weave_backend/__init__.py` (the FastAPI dev entrypoint) binds
`0.0.0.0` — bandit flags this Medium (B104). Pre-existing from PR #9,
already has a `# noqa: S104` rationale (dev entrypoint only); out of this
task's scope to change.

## Deferred to live verification (cannot be done from this repo per Law F)

- `deploy-essential-dev`'s actual `terraform apply` against real AWS —
  authored and gated correctly, but never run; first real execution
  happens once a human sets `vars.DEPLOY_ROLE_ARN`.
- The OIDC trust policy itself (not Terraform-managed, see decision 6) —
  needs to actually be created in AWS IAM before the above can run.
- `test_local_stack_boots` was run for real once during this task (not
  just structurally reviewed) and passed; it's excluded from the default
  CI fast lane (`integration` + `docker` markers) so it won't run again
  automatically until a nightly/local job invokes `pytest -m docker`.
