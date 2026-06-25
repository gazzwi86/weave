---
topic: data
stack: python
references:
  - docs/stack-equivalents.md
---

# Databricks SQL — databricks-sql-connector, Unity Catalog, Parameterised Statements

Python 3.12, databricks-sql-connector 3.x. Unity Catalog uses three-part names:
`<catalog>.<schema>.<table>`. Always use `%s` positional binding — never f-strings.

```python
# app/db/databricks_client.py
import os
import databricks.sql as dbsql
from contextlib import contextmanager

def _connection():
    return dbsql.connect(
        server_hostname = os.environ["DATABRICKS_HOST"],        # e.g. adb-123.azuredatabricks.net
        http_path       = os.environ["DATABRICKS_HTTP_PATH"],   # /sql/1.0/warehouses/abc123
        access_token    = os.environ["DATABRICKS_TOKEN"],
        catalog         = os.environ.get("DATABRICKS_CATALOG", "main"),
        schema          = os.environ.get("DATABRICKS_SCHEMA",  "myapp"),
    )

@contextmanager
def cursor():
    """Yields a cursor; connection is closed on exit."""
    conn = _connection()
    try:
        with conn.cursor() as cur:
            yield cur
    finally:
        conn.close()
```

```python
# app/repositories/events_repository.py
from datetime import date
from app.db.databricks_client import cursor


def get_daily_revenue(start_date: date, end_date: date) -> list[dict]:
    """
    Unity Catalog three-part name: main.myapp.orders
    %s positional binding prevents SQL injection.
    """
    sql = """
        SELECT
            DATE(created_at)  AS order_date,
            SUM(total)        AS revenue,
            COUNT(*)          AS order_count
        FROM   main.myapp.orders
        WHERE  created_at BETWEEN %s AND %s
          AND  status != 'cancelled'
        GROUP BY DATE(created_at)
        ORDER BY 1
    """
    with cursor() as cur:
        cur.execute(sql, (start_date.isoformat(), end_date.isoformat()))
        columns = [d[0] for d in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]


def upsert_customer_segment(records: list[tuple]) -> None:
    """
    records: [(customer_id, segment, score), ...]
    MERGE into a Delta table — idempotent upsert.
    """
    sql = """
        MERGE INTO main.myapp.customer_segments AS target
        USING (VALUES (%s, %s, %s)) AS source(customer_id, segment, score)
        ON target.customer_id = source.customer_id
        WHEN MATCHED THEN UPDATE SET segment = source.segment, score = source.score
        WHEN NOT MATCHED THEN INSERT (customer_id, segment, score)
          VALUES (source.customer_id, source.segment, source.score)
    """
    with cursor() as cur:
        for record in records:
            cur.execute(sql, record)
```

```python
# Fetch Arrow batches for large result sets (avoids OOM)
def stream_large_table(table: str, batch_size: int = 10_000):
    with cursor() as cur:
        cur.execute(f"SELECT * FROM main.myapp.{table}")  # noqa: S608 — table name is internal
        while True:
            batch = cur.fetchmany(batch_size)
            if not batch:
                break
            yield batch
```

**Why:** Three-part Unity Catalog names make the lineage unambiguous across
catalogs. `%s` binding is the only safe way to include user-provided values.
`fetchmany` for large result sets avoids loading millions of rows into memory.
