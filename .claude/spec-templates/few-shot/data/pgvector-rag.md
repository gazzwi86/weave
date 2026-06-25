---
topic: data
stack: python
references:
  - docs/stack-equivalents.md
---

# pgvector — vector(1536), HNSW Index, Similarity Query, Hybrid Search

pgvector 0.7+, Python 3.12, SQLAlchemy 2.0 async, asyncpg.
1536-dim vectors match OpenAI `text-embedding-3-small` output.

```python
# app/models/document.py
from __future__ import annotations
import uuid
from pgvector.sqlalchemy import Vector
from sqlalchemy import Index, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Document(Base):
    __tablename__ = "documents"

    id:         Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    content:    Mapped[str]       = mapped_column(Text, nullable=False)
    source_url: Mapped[str]       = mapped_column(String(2048), nullable=True)
    # 1536 dims for text-embedding-3-small; use 3072 for text-embedding-3-large
    embedding:  Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)

    __table_args__ = (
        # HNSW: fast approximate nearest-neighbour; m=16, ef_construction=64 are good defaults
        Index(
            "ix_documents_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )
```

```python
# app/repositories/document_repository.py
from typing import Sequence
from uuid import UUID
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.document import Document


SIMILARITY_THRESHOLD = 0.75   # cosine similarity; tune per corpus


async def semantic_search(
    session: AsyncSession,
    query_embedding: list[float],
    limit: int = 10,
) -> Sequence[Document]:
    """Pure vector search using cosine distance."""
    stmt = (
        select(Document)
        .order_by(Document.embedding.cosine_distance(query_embedding))
        .limit(limit)
    )
    result = await session.execute(stmt)
    return result.scalars().all()


async def hybrid_search(
    session: AsyncSession,
    query_text: str,
    query_embedding: list[float],
    limit: int = 10,
) -> Sequence[Document]:
    """
    Hybrid: combine BM25 (full-text) + cosine similarity via RRF.
    Requires pg_trgm or ts_rank; here we use ts_rank.
    """
    stmt = text("""
        SELECT d.*, (
            0.5 * (1 - (d.embedding <=> :vec))          -- cosine similarity (0-1)
          + 0.5 * ts_rank(to_tsvector('english', d.content), plainto_tsquery(:q))
        ) AS score
        FROM documents d
        ORDER BY score DESC
        LIMIT :lim
    """)
    result = await session.execute(stmt, {"vec": str(query_embedding), "q": query_text, "lim": limit})
    return result.fetchall()
```

```python
# Generating embeddings (OpenAI)
from openai import AsyncOpenAI

client = AsyncOpenAI()

async def embed(text: str) -> list[float]:
    resp = await client.embeddings.create(input=text, model="text-embedding-3-small")
    return resp.data[0].embedding
```

```sql
-- Enable extension in migration
CREATE EXTENSION IF NOT EXISTS vector;
-- Set ef_search for higher recall at query time (session-level)
SET hnsw.ef_search = 100;
```

**Why:** HNSW outperforms IVFFlat at recall for typical RAG corpus sizes.
`vector_cosine_ops` matches the `<=>` operator used in queries. Hybrid search
with RRF outperforms pure vector search on keyword-heavy queries.
