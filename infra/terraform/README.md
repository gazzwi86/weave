# infra/terraform

Full local+remote module set for the Weave platform, authored now but with
only the essential dev-account pieces actually deployed this phase (Cognito,
Secrets Manager, the Terraform state backend). Everything under `Non-essential
prod stack` in `environments/dev/main.tf` is gated behind the
`deploy_prod_stack` variable (default `false`) and resolves to zero resources
until a later phase turns it on.

## Layout

- `modules/*` — shared module code (cognito, secrets, s3_state, dynamo_lock,
  aurora_pg, elasticache, s3_assets, s3_spa, cloudfront, vpc).
- `environments/dev/` — the one live root config right now (`main.tf` +
  `variables.tf` + `providers.tf` + `dev.tfvars`).
- `environments/staging/`, `environments/prod/` — tfvars-only placeholders;
  see their READMEs for how to activate them (copy dev's `.tf` files
  unchanged — environments vary by tfvars only).

## State backend bootstrap (two-phase, chicken-and-egg)

`providers.tf`'s `backend "s3"` block points at `module.s3_state` /
`module.dynamo_lock`'s own bucket/table — which don't exist on a fresh
account. First-ever apply for this environment must run with
`terraform init -backend=false` (local state) to create those two modules,
then `terraform init -migrate-state` once to move state into them. Every test
in this repo (and this task's author) only ever runs `-backend=false` —
nobody has run a real `apply` from this repo (Law F).

## OIDC deploy role (bootstrapped by a human, not by this Terraform)

CI's `deploy-essential-dev` job assumes an IAM role via GitHub OIDC
(`vars.DEPLOY_ROLE_ARN`), guarded to no-op until that repo variable is set.
That role can't be created by this Terraform — deploying it would need the
role to already exist. It's bootstrapped once, out of band, with a trust
policy scoped to:

```
Principal: token.actions.githubusercontent.com (OIDC provider)
Condition: StringLike
  token.actions.githubusercontent.com:sub = "repo:gazzwi86/weave:ref:refs/heads/main"
  token.actions.githubusercontent.com:aud = "sts.amazonaws.com"
```

`gazzwi86/weave` is this repo's actual `origin` remote (verified via
`git remote get-url origin`) — use the real remote, not a placeholder, if
this is ever forked. Grant the role least-privilege access to the services
the essential-dev apply touches (cognito-idp, secretsmanager, s3, dynamodb,
sts:GetCallerIdentity) rather than AdministratorAccess.
