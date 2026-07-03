# ponytail: refresh_token_validity=60s is the binding design decision from the
# task brief, but AWS Cognito's real minimum for refresh tokens may be higher
# than 60 seconds — this will only be discovered at real `apply` time (never
# run from this repo per Law F). Flagged for architect/QA confirmation before
# the first real deploy; see the task's progress summary.

resource "aws_cognito_user_pool" "this" {
  name = var.pool_name

  mfa_configuration = var.mfa

  password_policy {
    minimum_length    = 12
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }

  dynamic "software_token_mfa_configuration" {
    for_each = var.mfa == "OFF" ? [] : [1]
    content {
      enabled = true
    }
  }
}

resource "aws_cognito_user_pool_client" "this" {
  name         = "${var.pool_name}-client"
  user_pool_id = aws_cognito_user_pool.this.id

  explicit_auth_flows = ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]

  token_validity_units {
    access_token  = "seconds"
    id_token      = "seconds"
    refresh_token = "seconds"
  }

  access_token_validity  = var.token_validity_seconds
  id_token_validity      = var.token_validity_seconds
  refresh_token_validity = var.token_validity_seconds
}
