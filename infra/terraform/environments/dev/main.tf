# Essential (deployed this phase, by CI's deploy-essential-dev job — see
# .github/workflows/ci.yml). Everything below this comment is gated behind
# deploy_prod_stack and resolves to zero resources while it's false.

module "cognito" {
  source    = "../../modules/cognito"
  pool_name = "weave-dev"
  mfa       = "OPTIONAL"
  # access/ID + refresh token validity use the module's minimum defaults
  # (300s / 3600s) — see ADR-001 for why the brief's 60s figure isn't legal.
}

module "secrets" {
  source      = "../../modules/secrets"
  name_prefix = "weave-dev"
  small       = true
}

module "s3_state" {
  source      = "../../modules/s3_state"
  bucket_name = "weave-tf-state-dev"
  versioning  = true
  sse         = true
}

module "dynamo_lock" {
  source       = "../../modules/dynamo_lock"
  table_name   = "weave-tf-lock-dev"
  billing_mode = "PAY_PER_REQUEST"
}

# --- Non-essential prod stack (gated) ---------------------------------------

module "vpc" {
  count  = var.deploy_prod_stack ? 1 : 0
  source = "../../modules/vpc"
  name   = "weave-prod"
}

module "aurora_pg" {
  count      = var.deploy_prod_stack ? 1 : 0
  source     = "../../modules/aurora_pg"
  engine     = "aurora-postgresql"
  min_acus   = 0.5
  max_acus   = 4
  db_name    = "weave"
  subnet_ids = module.vpc[0].private_subnet_ids
}

module "elasticache" {
  count          = var.deploy_prod_stack ? 1 : 0
  source         = "../../modules/elasticache"
  engine         = "redis"
  engine_version = "7.1"
  node_type      = "cache.t4g.micro"
  subnet_ids     = module.vpc[0].private_subnet_ids
}

module "s3_assets" {
  count       = var.deploy_prod_stack ? 1 : 0
  source      = "../../modules/s3_assets"
  bucket_name = "weave-assets-dev"
}

module "s3_spa" {
  count       = var.deploy_prod_stack ? 1 : 0
  source      = "../../modules/s3_spa"
  bucket_name = "weave-spa-dev"
  public_read = false
  website     = true
}

module "cloudfront" {
  count              = var.deploy_prod_stack ? 1 : 0
  source             = "../../modules/cloudfront"
  origin_domain_name = module.s3_spa[0].bucket_regional_domain_name
}
