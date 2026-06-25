terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Remote state backend — fill in once an AWS account/bucket exists.
  # backend "s3" {
  #   bucket       = "weave-tfstate"
  #   key          = "weave/terraform.tfstate"
  #   region       = "eu-west-2"
  #   use_lockfile = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "weave"
      ManagedBy = "terraform"
      Env       = var.environment
    }
  }
}
