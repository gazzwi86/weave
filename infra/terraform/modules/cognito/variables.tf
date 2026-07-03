variable "pool_name" {
  description = "Cognito user pool name"
  type        = string
}

variable "mfa" {
  description = "MFA configuration: OFF, ON, or OPTIONAL"
  type        = string
  default     = "OPTIONAL"

  validation {
    condition     = contains(["OFF", "ON", "OPTIONAL"], var.mfa)
    error_message = "mfa must be one of OFF, ON, OPTIONAL."
  }
}

variable "access_id_token_validity_seconds" {
  description = "Access/ID token validity, in seconds. AWS enforces a 5m-24h range (see ADR-001)."
  type        = number
  default     = 300

  validation {
    condition     = var.access_id_token_validity_seconds >= 300 && var.access_id_token_validity_seconds <= 86400
    error_message = "access/ID token validity must be between 300 (5m) and 86400 (24h) seconds."
  }
}

variable "refresh_token_validity_seconds" {
  description = "Refresh token validity, in seconds. AWS enforces a 1h-8760h range (see ADR-001)."
  type        = number
  default     = 3600

  validation {
    condition     = var.refresh_token_validity_seconds >= 3600 && var.refresh_token_validity_seconds <= 31536000
    error_message = "refresh token validity must be between 3600 (1h) and 31536000 (8760h) seconds."
  }
}
