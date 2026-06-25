variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "eu-west-2"
}

variable "environment" {
  description = "Deployment environment name (e.g. dev, staging, prod)."
  type        = string
  default     = "dev"
}

variable "app_name" {
  description = "Base name for tagged/created resources."
  type        = string
  default     = "weave"
}

variable "backend_image" {
  description = "Container image URI for the backend (pushed to ECR by CI)."
  type        = string
  default     = ""
}

variable "frontend_image" {
  description = "Container image URI for the frontend (pushed to ECR by CI)."
  type        = string
  default     = ""
}

variable "anthropic_api_key" {
  description = "Anthropic API key for the LLM features (store in Secrets Manager)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "backend_cpu" {
  description = "Fargate task CPU units for the backend."
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Fargate task memory (MiB) for the backend."
  type        = number
  default     = 1024
}
