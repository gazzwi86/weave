resource "aws_dynamodb_table" "this" {
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
