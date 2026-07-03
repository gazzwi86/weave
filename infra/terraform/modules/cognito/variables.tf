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

variable "token_validity_seconds" {
  description = "Access/ID/refresh token validity, in seconds (design decision: 60s for m1)"
  type        = number
  default     = 60
}
