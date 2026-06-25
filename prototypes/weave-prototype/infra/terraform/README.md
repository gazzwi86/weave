# Weave infrastructure (Terraform) — skeleton

> **Status: not yet applied.** The target AWS account is TBD (ROADMAP.md, P7).
> This is a deliberate, minimal scaffold so the deployment topology decision is
> made with intent rather than by default. See ADR-014 in `ROADMAP.md`.

## What's here today

- `versions.tf` — Terraform/AWS provider pins; commented S3 remote-state backend.
- `variables.tf` — region, environment, app name, image URIs, sizing, secrets.
- `main.tf` — ECR repositories (backend + frontend) and an ECS cluster shell,
  with the compute/ALB/secrets wiring left as documented TODOs.
- `outputs.tf` — ECR URLs and the cluster name.
- `terraform.tfvars.example` — copy to `terraform.tfvars` (git-ignored).

## Before this can be applied

1. Provision an AWS account and an S3 bucket for remote state; uncomment and
   fill the `backend "s3"` block in `versions.tf`.
2. Have CI push images to the ECR repos this creates.
3. Complete the compute topology in `main.tf`:
   - decide **ECS Fargate vs. AWS App Runner vs. Lambda + API Gateway**;
   - VPC/subnets/security groups, task + execution IAM roles;
   - backend task definition with a persistent volume (EFS) for the Oxigraph
     store — or migrate the store to a managed backend;
   - ALB + HTTPS (ACM), Secrets Manager for `ANTHROPIC_API_KEY`;
   - frontend via S3 + CloudFront (or a second Fargate service);
   - autoscaling, logging, alarms.

## Usage (once completed)

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # then edit
terraform init
terraform plan
terraform apply
```
