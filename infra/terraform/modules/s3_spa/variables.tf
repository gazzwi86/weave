variable "bucket_name" {
  type = string
}

variable "public_read" {
  description = "Must stay false — CloudFront reaches the bucket via Origin Access Control, never a public bucket policy"
  type        = bool
  default     = false
}

variable "website" {
  description = "Enable S3 static-website-hosting config (index/error documents) behind CloudFront"
  type        = bool
  default     = true
}
