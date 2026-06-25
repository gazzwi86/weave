---
topic: data
stack: cross-stack
references:
  - docs/stack-equivalents.md
---

# AWS S3 Vectors (2025 GA) — CreateVectorBucket, PutVectors, QueryVectors

S3 Vectors is a serverless managed vector store backed by S3 (GA April 2025).
No cluster to manage; pay-per-request. Supports 1536-dim embeddings.

## TypeScript — @aws-sdk/client-s3vectors

```ts
// src/db/s3vectors-client.ts
import {
  S3VectorsClient,
  CreateVectorBucketCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
  DeleteVectorsCommand,
} from "@aws-sdk/client-s3vectors";

export const s3v = new S3VectorsClient({ region: process.env.AWS_REGION ?? "us-east-1" });

export const BUCKET = process.env.S3_VECTOR_BUCKET ?? "myapp-vectors";
export const INDEX  = "documents";   // index name within the bucket
```

```ts
// src/vectors/vector.repository.ts
import { s3v, BUCKET, INDEX } from "../db/s3vectors-client";
import {
  PutVectorsCommand, QueryVectorsCommand, DeleteVectorsCommand,
} from "@aws-sdk/client-s3vectors";

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata?: Record<string, string | number | boolean>;
}

/** Upsert up to 500 vectors per call (SDK limit). */
export async function putVectors(records: VectorRecord[]): Promise<void> {
  await s3v.send(new PutVectorsCommand({
    vectorBucketName: BUCKET,
    indexName:        INDEX,
    vectors: records.map((r) => ({
      key:      r.id,
      data:     { float32: r.vector },
      metadata: r.metadata,
    })),
  }));
}

/** k-NN query — returns up to `topK` nearest neighbours. */
export async function queryVectors(
  queryVector: number[],
  topK = 10,
  filter?: Record<string, unknown>,
): Promise<{ id: string; score: number; metadata?: Record<string, unknown> }[]> {
  const res = await s3v.send(new QueryVectorsCommand({
    vectorBucketName: BUCKET,
    indexName:        INDEX,
    queryVector:      { float32: queryVector },
    topK,
    filter,           // metadata filter expression (JSON)
    returnMetadata:   true,
    returnDistance:   true,
  }));
  return (res.vectors ?? []).map((v) => ({
    id:       v.key ?? "",
    score:    v.distance ?? 0,
    metadata: v.metadata,
  }));
}

export async function deleteVectors(ids: string[]): Promise<void> {
  await s3v.send(new DeleteVectorsCommand({
    vectorBucketName: BUCKET,
    indexName:        INDEX,
    keys: ids,
  }));
}
```

## Python — boto3

```python
# app/db/s3vectors.py
import os
import boto3
from typing import Any

client = boto3.client("s3vectors", region_name=os.environ.get("AWS_REGION", "us-east-1"))
BUCKET = os.environ.get("S3_VECTOR_BUCKET", "myapp-vectors")
INDEX  = "documents"

def put_vectors(records: list[dict]) -> None:
    """records: [{"id": str, "vector": list[float], "metadata": dict}]"""
    client.put_vectors(
        vectorBucketName=BUCKET,
        indexName=INDEX,
        vectors=[
            {"key": r["id"], "data": {"float32": r["vector"]}, "metadata": r.get("metadata", {})}
            for r in records
        ],
    )

def query_vectors(query_vector: list[float], top_k: int = 10) -> list[dict[str, Any]]:
    resp = client.query_vectors(
        vectorBucketName=BUCKET,
        indexName=INDEX,
        queryVector={"float32": query_vector},
        topK=top_k,
        returnMetadata=True,
        returnDistance=True,
    )
    return [{"id": v["key"], "score": v["distance"], "metadata": v.get("metadata")}
            for v in resp.get("vectors", [])]
```

**Why:** S3 Vectors requires no provisioning or index-building step — ideal for
variable-workload RAG. Use `topK` + metadata filters to narrow results before
re-ranking. Batches of 500 are the SDK maximum for `PutVectors`.
