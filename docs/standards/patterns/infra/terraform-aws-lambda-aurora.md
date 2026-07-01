---
type: Coding Standard
title: "Infra — Lambda + Aurora Serverless v2 with a Secrets Manager DB secret (terraform)"
description: "Golden Terraform pattern: an AWS Lambda function with a least-privilege execution role, an Aurora PostgreSQL Serverless v2 cluster, and a DB credential read from AWS Secrets Manager — never hard-coded, with pinned provider and required_version."
tags: [standards, patterns, infra, terraform]
timestamp: 2026-07-01
resource: docs/standards/patterns/infra/terraform-aws-lambda-aurora.md
topic: infra
stack: terraform
verification: "terraform fmt -check OK; terraform init -backend=false + terraform validate OK (Success! The configuration is valid.) — aws provider v5.100.0, terraform v1.15.7"
---

# Infra — Lambda + Aurora Serverless v2 with a Secrets Manager DB secret (terraform)

**Intent.** Provision Weave's primary compute + relational tier the golden way: a Python 3.12
Lambda (the primary compute per the confirmed stack), an Aurora PostgreSQL Serverless v2 cluster,
and the DB credentials sourced from AWS Secrets Manager — never written into Terraform, tfvars,
or environment literals. The Lambda role is scoped to exactly the one secret ARN it needs plus the
managed VPC-access policy (which also grants CloudWatch Logs). Provider and Terraform versions are
pinned so a `terraform init` months from now resolves the same schema.

```hcl
terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------
variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "eu-west-2"
}

variable "name_prefix" {
  description = "Prefix for all resource names (e.g. weave-constitution)."
  type        = string
  default     = "weave-constitution"
}

variable "db_secret_name" {
  description = "Name of the pre-provisioned Secrets Manager secret holding DB credentials. The value never appears in Terraform."
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs for the Aurora cluster and the Lambda ENIs."
  type        = list(string)
}

variable "vpc_security_group_ids" {
  description = "Security groups guarding the Aurora cluster and Lambda ENIs."
  type        = list(string)
}

variable "lambda_zip_path" {
  description = "Path to the built deployment package, produced by CI."
  type        = string
  default     = "build/handler.zip"
}

# ---------------------------------------------------------------------------
# DB credentials: READ from Secrets Manager, never hard-code
# ---------------------------------------------------------------------------
data "aws_secretsmanager_secret" "db" {
  name = var.db_secret_name
}

# ---------------------------------------------------------------------------
# Aurora PostgreSQL Serverless v2
# ---------------------------------------------------------------------------
resource "aws_db_subnet_group" "this" {
  name       = "${var.name_prefix}-db-subnets"
  subnet_ids = var.subnet_ids
}

resource "aws_rds_cluster" "this" {
  cluster_identifier = "${var.name_prefix}-aurora"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = "16.4"
  database_name      = "weave"

  # RDS mints and rotates the master credential in Secrets Manager for us —
  # so no password is ever expressed in Terraform state as plaintext input.
  manage_master_user_password = true
  master_username             = "weave_admin"

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = var.vpc_security_group_ids

  storage_encrypted         = true
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.name_prefix}-final"

  serverlessv2_scaling_configuration {
    min_capacity = 0.5
    max_capacity = 4.0
  }
}

resource "aws_rds_cluster_instance" "this" {
  identifier          = "${var.name_prefix}-aurora-1"
  cluster_identifier  = aws_rds_cluster.this.id
  engine              = aws_rds_cluster.this.engine
  engine_version      = aws_rds_cluster.this.engine_version
  instance_class      = "db.serverless"
  publicly_accessible = false
}

# ---------------------------------------------------------------------------
# Lambda execution role — least privilege
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "lambda_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  name               = "${var.name_prefix}-lambda-exec"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

# VPC ENI management + CloudWatch Logs (AWS-managed, no wildcards we author).
resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# The ONLY custom grant: read exactly one secret ARN. No secretsmanager:* wildcard.
data "aws_iam_policy_document" "lambda_secret_read" {
  statement {
    sid       = "ReadDbSecretOnly"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [data.aws_secretsmanager_secret.db.arn]
  }
}

resource "aws_iam_role_policy" "lambda_secret_read" {
  name   = "${var.name_prefix}-read-db-secret"
  role   = aws_iam_role.lambda.id
  policy = data.aws_iam_policy_document.lambda_secret_read.json
}

# ---------------------------------------------------------------------------
# Lambda function (primary compute)
# ---------------------------------------------------------------------------
resource "aws_lambda_function" "api" {
  function_name = "${var.name_prefix}-api"
  role          = aws_iam_role.lambda.arn
  runtime       = "python3.12"
  handler       = "app.main.handler"
  filename      = var.lambda_zip_path
  # Key the update on zip CONTENT, not just the path — otherwise a rebuilt same-named
  # zip shows no diff and `apply` silently ships stale code.
  source_code_hash = filebase64sha256(var.lambda_zip_path)
  timeout          = 30
  memory_size      = 512

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.vpc_security_group_ids
  }

  environment {
    variables = {
      # Pass the ARN, not the secret value — the function fetches + caches at runtime.
      DB_SECRET_ARN = data.aws_secretsmanager_secret.db.arn
      DB_HOST       = aws_rds_cluster.this.endpoint
      DB_NAME       = aws_rds_cluster.this.database_name
    }
  }

  tracing_config {
    mode = "Active" # X-Ray, fed through the ADOT collector downstream.
  }
}
```

**Why.**
- **Lambda is the primary compute** in the confirmed Weave stack (ECS Fargate is reserved for
  long-running agents). Python 3.12 matches the backend language contract.
- **Aurora Serverless v2** (`engine_mode = "provisioned"` + a `serverlessv2_scaling_configuration`
  block + `instance_class = "db.serverless"`) is the required relational tier; it scales ACUs to
  zero-ish idle cost while presenting a standard Postgres endpoint to SQLAlchemy async.
- **`manage_master_user_password = true`** makes RDS create and rotate the master credential in
  Secrets Manager, so no password is ever supplied as a Terraform input (which would otherwise land
  in state and plan output as plaintext).
- **Pinned `required_version` and provider `~> 5.60`** guarantee a reproducible `init`.

**Security.**
- **Secrets Manager only, never hard-coded.** The DB secret is *read* via a `data` source and only
  its ARN is passed to the Lambda; the function retrieves the value at runtime. No credential
  appears in `.tf`, `.tfvars`, or Lambda environment literals — matching the "AWS Secrets Manager
  only" rule.
- **Least-privilege IAM.** The execution role trusts only `lambda.amazonaws.com`, attaches the
  AWS-managed `AWSLambdaVPCAccessExecutionRole` (ENI + Logs), and adds a single inline statement
  granting `secretsmanager:GetSecretValue` on the *specific* secret ARN — never `secretsmanager:*`
  or `Resource = "*"`.
- **Network isolation.** Aurora sits in private subnets (`publicly_accessible = false`) behind a
  security group; the Lambda joins the same VPC via `vpc_config`. `storage_encrypted = true` and
  `deletion_protection = true` are on by default.

**Anti-patterns.**
- Passing `master_password = var.db_password` (or any literal) — the credential leaks into state.
- Putting the secret *value* (not the ARN) into the Lambda `environment` block.
- `Resource = "*"` or `secretsmanager:*` on the execution role.
- Legacy Aurora Serverless v1 (`engine_mode = "serverless"`) — v2 is the standard.
- Omitting `source_code_hash` on the Lambda — Terraform keys the update on `filename` (the path),
  so a rebuilt same-named zip shows no diff and `apply` ships stale code.
- Unpinned provider (`version = ">= 5.0"` with no upper bound) or a missing `required_version`.
- A publicly accessible cluster, or an unencrypted one.
