variable "name_prefix" {
  description = "Secret name prefix (Secrets Manager appends a random suffix)"
  type        = string
}

variable "small" {
  description = "Dev/test toggle: true = 0-day recovery window (immediate delete), false = 30-day"
  type        = bool
  default     = true
}
