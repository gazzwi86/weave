# Encrypted at rest with the AWS-owned key (see server_side_encryption below). A
# customer CMK adds no value for a table that holds only Terraform state-lock
# digests, and costs a key to manage — intentionally deferred.
resource "aws_dynamodb_table" "this" { # nosemgrep: terraform.aws.security.aws-dynamodb-table-unencrypted.aws-dynamodb-table-unencrypted
  name         = var.table_name
  billing_mode = var.billing_mode
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  # Encrypt at rest. AWS-owned key is free (no CMK to manage); the lock table
  # holds only Terraform state-lock digests, so a customer CMK adds no value.
  server_side_encryption {
    enabled = true
  }
}
