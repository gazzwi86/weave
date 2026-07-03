terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Bootstrap order: this bucket/table don't exist on a brand-new account, so
  # the very first `terraform init` for this environment must run with
  # `-backend=false` (or a local backend) to create module.s3_state /
  # module.dynamo_lock, THEN `terraform init -migrate-state` once to move
  # state here. Every test in this repo uses `-backend=false` for exactly
  # this reason (Law F: never a real apply from this repo/agent).
  backend "s3" {
    bucket         = "weave-tf-state-dev"
    key            = "platform/terraform.tfstate"
    region         = "ap-southeast-2"
    dynamodb_table = "weave-tf-lock-dev"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  # offline_test is test-only (see tests/integration/test_terraform_plan.py):
  # it lets `terraform plan` run with zero network calls to AWS by skipping
  # the provider's credential/account/region checks. Never set true for a
  # real deploy — CI's OIDC-authenticated apply always leaves it at false.
  skip_credentials_validation = var.offline_test
  skip_requesting_account_id  = var.offline_test
  skip_region_validation      = var.offline_test
  skip_metadata_api_check     = var.offline_test
}
