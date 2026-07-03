variable "origin_domain_name" {
  description = "S3 SPA bucket regional domain name (module.s3_spa[0].bucket_regional_domain_name)"
  type        = string
}

variable "origin_id" {
  type    = string
  default = "spa-origin"
}

variable "price_class" {
  type    = string
  default = "PriceClass_100"
}
