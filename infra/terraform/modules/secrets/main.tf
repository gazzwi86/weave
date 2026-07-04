# Encrypted with the AWS-managed KMS key (Secrets Manager default). A customer
# CMK is a v1 hardening item; AWS-managed encryption is sufficient for the MVP.
resource "aws_secretsmanager_secret" "this" { # nosemgrep: terraform.aws.security.aws-secretsmanager-secret-unencrypted.aws-secretsmanager-secret-unencrypted
  name_prefix             = "${var.name_prefix}-"
  recovery_window_in_days = var.small ? 0 : 30
}

# Placeholder version so the secret has a value from creation; real values are
# set out-of-band (console/CI), never as a Terraform literal (no hardcoded
# secrets — see .claude/rules/security.md).
resource "aws_secretsmanager_secret_version" "this" {
  secret_id     = aws_secretsmanager_secret.this.id
  secret_string = jsonencode({ placeholder = "set via console or CI, not terraform" })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
