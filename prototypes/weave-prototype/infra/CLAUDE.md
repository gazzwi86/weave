# infra/CLAUDE.md

Terraform skeleton for the Weave AWS deployment. **Not yet applied** — see ROADMAP.md milestone P7.

## Current state

`terraform/` contains an intentionally minimal scaffold:

- `main.tf` — ECR repos (backend + frontend, IMMUTABLE tags, scan on push) + ECS cluster shell with Container Insights. Compute/ALB/secrets are documented TODOs.
- `variables.tf` — `aws_region` (eu-west-2), `environment`, `app_name`, `backend_image`, `frontend_image`, `anthropic_api_key` (sensitive), Fargate CPU/memory.
- `versions.tf` — provider + backend configuration (remote state backend is a TODO).
- `outputs.tf` — ECR repo URLs.
- `terraform.tfvars.example` — copy to `terraform.tfvars` and fill in before applying.

## Prerequisites before `terraform apply`

Per ADR-014, do not apply until all of these are met:

1. An AWS account is confirmed and the target region chosen.
2. Remote state backend (S3 + DynamoDB lock) is configured in `versions.tf`.
3. CI is pushing images to ECR (images exist before the task definition can reference them).
4. The compute topology decision is made (ECS Fargate vs. App Runner vs. Lambda+API GW — ADR pending, milestone P7).
5. The remaining TODOs in `main.tf` are completed: VPC, task definition (with EFS volume for Oxigraph), ECS service, ALB + HTTPS, Secrets Manager for `ANTHROPIC_API_KEY`, IAM roles, security groups.

## Key decisions pending (P7)

- **Compute topology**: ECS Fargate (most control, EFS volume) vs. App Runner (simpler, no persistent volume without separate store) vs. Lambda+API GW (cold-start risk for RDF).
- **Oxigraph persistence**: EFS mount on Fargate is the current assumption; a managed alternative (e.g. Fuseki on ECS, or a different store) is a revisit candidate at scale.
- **Frontend serving**: S3 + CloudFront or a second Fargate service (Nginx).
- **Auth/tenancy**: single-tenant MVP, then evaluate Cognito or external IdP.

## Terraform commands (when ready)

```bash
cd infra/terraform
terraform init      # initialise providers + remote state
terraform plan      # preview changes
terraform apply     # apply (never run without a confirmed AWS account + state backend)
```

Do not run `terraform apply` without explicit confirmation from the project owner. See ROADMAP.md P7 for the gating criteria.
