---
type: Coding Standard
title: "Amazon S3 Vectors — Create/Put/Query the Weave Vector Store (python)"
description: "Golden pattern for the Weave vector store: create an S3 Vectors index, put embeddings with metadata, and run a similarity query with an optional metadata filter, using boto3."
tags: [standards, patterns, data, python]
timestamp: 2026-07-01
resource: docs/standards/patterns/data/s3-vectors.md
topic: data
stack: python
verification: "UNVERIFIED (docs-only, 2026-07-01) — not run against a live SDK; validate before first use"
sources:
  - https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors-getting-started.html
  - https://docs.aws.amazon.com/AmazonS3/latest/API/API_S3VectorBuckets_CreateIndex.html
---

# Amazon S3 Vectors — Create/Put/Query the Weave Vector Store (python)

**Intent.** Use Amazon S3 Vectors — Weave's vector store (not pgvector) — to create a
vector index, insert embeddings with filterable metadata, and run a similarity search with
an optional metadata filter. Embeddings here come from a Bedrock embedding model, but any
`float32` vector of the index's dimension works.

```python
"""Create an S3 Vectors index, put embeddings, and query by similarity.

Confirmed primary-source shapes:
  create_index params (dataType/dimension/distanceMetric/metadataConfiguration)
    — API_S3VectorBuckets_CreateIndex
  put_vectors / query_vectors — s3-vectors-getting-started (boto3 tutorial)
"""

import json

import boto3

bedrock = boto3.client("bedrock-runtime")   # ambient IAM role via STS
s3vectors = boto3.client("s3vectors")        # S3 Vectors data-plane client

# House rule: isolate tenants. Prefix the index (and optionally keys) per tenant,
# and scope the IAM policy to that prefix — a shared unscoped index leaks vectors.
BUCKET = "weave-embeddings"                   # a pre-existing S3 *vector* bucket
TENANT = "acme"
INDEX = f"tenant-{TENANT}--concepts"          # tenant-prefixed index name


def create_index() -> str:
    """Create the vector index. Immutable after creation: name, dimension,
    distanceMetric, and non-filterable metadata keys cannot be changed later."""
    resp = s3vectors.create_index(
        vectorBucketName=BUCKET,
        indexName=INDEX,
        dataType="float32",          # only valid value
        dimension=1024,              # 1..4096; must match the embedding model
        distanceMetric="cosine",     # "cosine" | "euclidean"
        metadataConfiguration={
            # excluded from filtering; use for reference payloads you never filter on
            "nonFilterableMetadataKeys": ["source_text"]
        },
    )
    return resp["indexArn"]


def _embed(text: str) -> list[float]:
    resp = bedrock.invoke_model(
        modelId="amazon.titan-embed-text-v2:0",
        body=json.dumps({"inputText": text}),
    )
    return json.loads(resp["body"].read())["embedding"]


def put_concepts(concepts: list[tuple[str, str, str]]) -> None:
    """concepts: (key, text, kind). Batch inserts for throughput."""
    s3vectors.put_vectors(
        vectorBucketName=BUCKET,
        indexName=INDEX,
        vectors=[
            {
                "key": key,                       # unique within the index
                "data": {"float32": _embed(text)},
                "metadata": {"source_text": text, "kind": kind},  # 'kind' is filterable
            }
            for key, text, kind in concepts
        ],
    )


def search(query_text: str, *, kind: str | None = None, top_k: int = 5) -> list[dict]:
    kwargs = {
        "vectorBucketName": BUCKET,
        "indexName": INDEX,
        "queryVector": {"float32": _embed(query_text)},
        "topK": top_k,
        "returnDistance": True,
        "returnMetadata": True,
    }
    if kind is not None:
        kwargs["filter"] = {"kind": kind}   # only filterable metadata keys work here
    return s3vectors.query_vectors(**kwargs)["vectors"]
```

**Why.** S3 Vectors is a purpose-built, cost-oriented vector store queried through a
dedicated data-plane client (`s3vectors`), distinct from the general-purpose `s3` client.
Vectors are inserted as `{"key", "data": {"float32": [...]}, "metadata": {...}}`; by default
every metadata key is filterable, except keys declared `nonFilterableMetadataKeys` at
create time (use those for large reference payloads like the original text). Similarity
search (`query_vectors`) takes a `queryVector`, `topK`, an optional metadata `filter`, and
`returnDistance`/`returnMetadata` flags, returning ranked `vectors`. Index `dimension`,
`distanceMetric`, name, and non-filterable keys are immutable — a mismatch with the
embedding model means rebuilding the index.

**Security (access-scope).** Tenant isolation is the load-bearing control: prefix the index
name (and keys) per tenant and scope the IAM policy (`s3vectors:CreateIndex`,
`s3vectors:PutVectors`, `s3vectors:QueryVectors`) to that prefix so a query in tenant A can
never return tenant B's vectors — mirror the cross-tenant-read release-gate test used for
Aurora/RDF. The client runs on an IAM role assumed via STS (never hardcoded keys). Do not
place secrets or raw PII in `metadata`; treat `source_text` and other reference payloads as
readable by anyone with query access to the index. Enable SSE (SSE-S3 default, or SSE-KMS
with a customer-managed key) on the vector bucket/index.

**Anti-patterns.**
- Using the `s3` client or treating an S3 Vectors bucket as a normal object bucket — it has
  its own APIs.
- A single shared index across tenants (cross-tenant leakage) instead of a per-tenant
  prefix + scoped IAM.
- Choosing `dimension`/`distanceMetric` that don't match the embedding model, then trying to
  change them (immutable — requires a new index).
- Filtering on a key declared in `nonFilterableMetadataKeys` (won't work).
- Reaching for pgvector/Pinecone/OpenSearch — S3 Vectors is the confirmed Weave store.

**Confidence.** High on `create_index` (params `vectorBucketName`, `indexName`, `dataType`
= `float32`, `dimension` 1..4096, `distanceMetric` ∈ `euclidean|cosine`,
`metadataConfiguration.nonFilterableMetadataKeys`, response `indexArn`) — quoted from the
CreateIndex API ref. High on `put_vectors` (`vectors[].key`, `.data.float32`, `.metadata`)
and `query_vectors` (`queryVector.float32`, `topK`, `filter`, `returnDistance`,
`returnMetadata`, response `["vectors"]`) — quoted from the boto3 getting-started tutorial.
Not confirmed from primary sources here: the `create_vector_bucket` signature (the tutorial
creates the bucket via the console) — the bucket is assumed to pre-exist; and the exact
grammar/operators of the `filter` object beyond simple `{key: value}` equality (the tutorial
shows only equality). The Titan `modelId` and 1024 dimension are from the same tutorial and
are illustrative — match dimension to whatever embedding model Weave actually uses.
