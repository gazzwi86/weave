---
type: Coding Standard
title: "Infra — CloudFront + private S3 SPA origin with OAC and TLS (terraform)"
description: "Golden Terraform pattern: a fully private S3 bucket served by a CloudFront distribution via Origin Access Control (OAC), with SPA routing (403/404 rewrite to index.html), redirect-to-HTTPS, and TLSv1.2_2021. No public bucket, no legacy OAI."
tags: [standards, patterns, infra, terraform]
timestamp: 2026-07-01
resource: docs/standards/patterns/infra/terraform-cloudfront-s3-spa.md
topic: infra
stack: terraform
verification: "terraform fmt -check OK; terraform init -backend=false + terraform validate OK (Success! The configuration is valid.) — aws provider v5.100.0, terraform v1.15.7"
---

# Infra — CloudFront + private S3 SPA origin with OAC and TLS (terraform)

**Intent.** Host the Weave single-page app the golden way: a **private** S3 bucket (all public
access blocked) that only CloudFront can read, fronted by a CloudFront distribution using **Origin
Access Control (OAC, SigV4)** — the modern replacement for Origin Access Identity. SPA deep links
are handled by rewriting 403/404 to `/index.html` with a 200, all traffic is forced to HTTPS, and
the viewer certificate enforces TLSv1.2_2021.

```hcl
terraform {
  required_version = ">= 1.9.0, < 2.0.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------
variable "aws_region" {
  description = "AWS region for the S3 bucket."
  type        = string
  default     = "eu-west-2"
}

variable "bucket_name" {
  description = "Globally unique S3 bucket name for the SPA build artefacts."
  type        = string
}

variable "aliases" {
  description = "Custom domain names served by the distribution (e.g. app.weave.io)."
  type        = list(string)
  default     = []
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for the CloudFront alias (TLS)."
  type        = string
}

# ---------------------------------------------------------------------------
# Private S3 bucket — no public access, ever
# ---------------------------------------------------------------------------
resource "aws_s3_bucket" "spa" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_public_access_block" "spa" {
  bucket                  = aws_s3_bucket.spa.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "spa" {
  bucket = aws_s3_bucket.spa.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "spa" {
  bucket = aws_s3_bucket.spa.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ---------------------------------------------------------------------------
# Origin Access Control — CloudFront signs origin requests with SigV4
# ---------------------------------------------------------------------------
resource "aws_cloudfront_origin_access_control" "spa" {
  name                              = "${var.bucket_name}-oac"
  description                       = "OAC for the Weave SPA bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# AWS-managed cache policy tuned for static assets.
data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

# ---------------------------------------------------------------------------
# CloudFront distribution
# ---------------------------------------------------------------------------
resource "aws_cloudfront_distribution" "spa" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = var.aliases
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.spa.bucket_regional_domain_name
    origin_id                = "s3-spa"
    origin_access_control_id = aws_cloudfront_origin_access_control.spa.id
  }

  default_cache_behavior {
    target_origin_id       = "s3-spa"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
  }

  # SPA client-side routing: unknown paths return the app shell, not an error.
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# ---------------------------------------------------------------------------
# Bucket policy: allow ONLY this distribution, via the OAC service principal
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "spa" {
  statement {
    sid     = "AllowCloudFrontOACRead"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    resources = ["${aws_s3_bucket.spa.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.spa.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "spa" {
  bucket = aws_s3_bucket.spa.id
  policy = data.aws_iam_policy_document.spa.json
}
```

**Why.**
- **OAC over OAI.** Origin Access Control is the current AWS-recommended mechanism; it signs origin
  fetches with SigV4 and supports SSE-KMS, whereas the legacy Origin Access Identity is deprecated.
- **SPA routing via `custom_error_response`.** Client-side routers own paths like `/graph/42`; S3
  returns 403/404 for those keys, so CloudFront rewrites both to `/index.html` with a 200 and the
  router takes over.
- **`Managed-CachingOptimized`** is the AWS-maintained cache policy for immutable, fingerprinted
  static assets — no hand-rolled TTLs to drift.
- **Pinned provider + `required_version`** for reproducible `init`.

**Security.**
- **No public S3.** `aws_s3_bucket_public_access_block` sets all four flags `true`; the bucket has
  no public policy and no ACL grants. The bucket is reachable *only* through CloudFront.
- **Least-privilege bucket policy.** Access is granted solely to the `cloudfront.amazonaws.com`
  service principal, `s3:GetObject` only, and scoped with an `AWS:SourceArn` condition to *this one
  distribution* — a different distribution cannot read the bucket.
- **TLS enforced.** `viewer_protocol_policy = "redirect-to-https"` plus
  `minimum_protocol_version = "TLSv1.2_2021"` and `sni-only`; the ACM cert lives in us-east-1 as
  CloudFront requires. Objects are encrypted at rest (SSE) and the bucket is versioned.

**Anti-patterns.**
- A public bucket / `block_public_policy = false` / a website-endpoint origin with `s3:GetObject`
  open to `*`.
- Legacy `aws_cloudfront_origin_access_identity` instead of OAC.
- A bucket policy scoped only to the service principal without the `AWS:SourceArn` condition (any
  CloudFront distribution in any account could then read it — the "confused deputy").
- `viewer_protocol_policy = "allow-all"` or `minimum_protocol_version = "TLSv1"` — weak/optional TLS.
- Omitting the SPA `custom_error_response` rewrite, so deep links 404.
- Unpinned provider or missing `required_version`.
