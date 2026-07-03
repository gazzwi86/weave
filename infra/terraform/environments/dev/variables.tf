variable "aws_region" {
  type    = string
  default = "ap-southeast-2"
}

variable "deploy_prod_stack" {
  description = "Gate for non-essential prod-scale modules (aurora_pg, elasticache, s3_assets, s3_spa, cloudfront, vpc). Off until M1/MVP is proven locally."
  type        = bool
  default     = false
}

variable "offline_test" {
  description = "Test-only: skip AWS credential/account/region validation for offline plan/validate. Never true for a real deploy."
  type        = bool
  default     = false
}
