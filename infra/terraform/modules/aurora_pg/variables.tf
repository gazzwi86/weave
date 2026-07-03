variable "engine" {
  type    = string
  default = "aurora-postgresql"
}

variable "engine_version" {
  type    = string
  default = "16.4"
}

variable "min_acus" {
  type    = number
  default = 0.5
}

variable "max_acus" {
  type    = number
  default = 4
}

variable "db_name" {
  type = string
}

variable "master_username" {
  type    = string
  default = "weave_admin"
}

variable "subnet_ids" {
  type = list(string)
}

variable "vpc_security_group_ids" {
  type    = list(string)
  default = []
}
