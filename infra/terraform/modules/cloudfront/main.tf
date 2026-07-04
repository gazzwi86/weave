resource "aws_cloudfront_origin_access_control" "this" {
  name                              = "weave-spa-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# minimum_protocol_version can only be set with an ACM cert; dev uses the
# CloudFront default cert (see viewer_certificate below). Setting a modern min
# TLS version is a v1 hardening item that lands with the real domain + ACM cert.
resource "aws_cloudfront_distribution" "this" { # nosemgrep: terraform.aws.security.aws-cloudfront-insecure-tls.aws-insecure-cloudfront-distribution-tls-version
  enabled             = true
  default_root_object = "index.html"
  price_class         = var.price_class

  origin {
    domain_name              = var.origin_domain_name
    origin_id                = var.origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = var.origin_id
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # dev-only default cert; swap for an ACM cert + custom domain when the SPA
  # goes live behind weave's real domain.
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
