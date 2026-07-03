variable "bucket_name" {
  type = string
}

variable "versioning" {
  type    = bool
  default = true
}

variable "sse" {
  description = "true = SSE-KMS, false = SSE-S3 (AES256) — state is always encrypted either way"
  type        = bool
  default     = true
}
