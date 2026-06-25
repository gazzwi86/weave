# Weave infrastructure — SKELETON.
#
# This is an intentionally minimal, NOT-YET-APPLIED scaffold for an AWS target
# account that is still TBD (see ROADMAP.md, milestone P7). It declares the
# container registries and the network/cluster shells a Fargate deployment
# needs, with the compute wiring left as documented TODOs so we make the real
# topology decision (ECS Fargate vs. App Runner vs. Lambda) with intent.
#
# Nothing here should be `terraform apply`-ed until:
#   1. an AWS account + remote state backend exist (see versions.tf),
#   2. images are being pushed to ECR by CI, and
#   3. the compute/ALB/secrets blocks below are completed.

locals {
  name = "${var.app_name}-${var.environment}"
}

# --- Container registries ----------------------------------------------------

resource "aws_ecr_repository" "backend" {
  name                 = "${local.name}-backend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "frontend" {
  name                 = "${local.name}-frontend"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

# --- Compute cluster ---------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = local.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# TODO(P7): complete the deployment topology, e.g.:
#   - VPC + public/private subnets (or reuse an existing one)
#   - aws_ecs_task_definition for backend (image = var.backend_image) with a
#     persistent volume (EFS) for the Oxigraph store, or move to a managed store
#   - aws_ecs_service behind an Application Load Balancer (HTTPS via ACM)
#   - aws_secretsmanager_secret for ANTHROPIC_API_KEY, injected as a task secret
#   - frontend served via S3 + CloudFront, or a second Fargate service
#   - security groups, IAM task/execution roles, autoscaling
#
# Decide ECS Fargate vs. AWS App Runner vs. Lambda+API Gateway here (ADR pending).
