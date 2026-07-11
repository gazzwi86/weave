"""CE-V1-TASK-012 AC-001-01: S3 corpus key layout.

`s3://weave-corpus-{env}/{tenant_id}/{artefact_hash}/original.{ext}`
-- pure key-building logic, no S3 client (docker-integration tests cover the
real LocalStack write).
"""

from __future__ import annotations

from weave_backend.ingest.corpus import corpus_bucket, corpus_key, hash_content


def test_corpus_bucket_is_env_scoped() -> None:
    assert corpus_bucket("prod") == "weave-corpus-prod"
    assert corpus_bucket("dev") == "weave-corpus-dev"


def test_corpus_key_matches_the_brief_layout() -> None:
    key = corpus_key(tenant_id="t1", artefact_hash="abc123", ext="pdf")
    assert key == "t1/abc123/original.pdf"


def test_hash_content_is_deterministic_and_16_chars() -> None:
    digest_a = hash_content(b"hello world")
    digest_b = hash_content(b"hello world")
    digest_c = hash_content(b"different")

    assert digest_a == digest_b
    assert digest_a != digest_c
    assert len(digest_a) == 16
