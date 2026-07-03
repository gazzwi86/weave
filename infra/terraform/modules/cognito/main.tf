# Deviation from the task brief's 60s token-validity decision: AWS validates
# aws_cognito_user_pool_client's duration attributes at plan time (not just
# apply), and rejects anything below 5m (access/ID) or 1h (refresh) — 60s is
# not a legal value. Using AWS's own minimums keeps tokens as short-lived as
# the platform allows. See ADR-001.

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

  access_token_validity  = var.access_id_token_validity_seconds
  id_token_validity      = var.access_id_token_validity_seconds
  refresh_token_validity = var.refresh_token_validity_seconds
}
