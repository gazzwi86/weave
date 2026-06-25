---
topic: data
stack: python
references:
  - docs/stack-equivalents.md
---

# Snowflake — snowflake-connector-python, Snowpark, Parameter Binding

Python 3.12, snowflake-connector-python 3.x, snowflake-snowpark-python 1.x.
Always use parameter binding — never f-string SQL. Use Snowpark for DataFrame
operations; use the connector for one-off queries and DDL.

```python
# app/db/snowflake_client.py
import os
import snowflake.connector
from snowflake.connector import DictCursor

def get_connection():
    """Single-use connection — close after use or use as context manager."""
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],    # e.g. xy12345.us-east-1
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],  # prefer key-pair in prod
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
        database=os.environ.get("SNOWFLAKE_DATABASE", "MYAPP_DB"),
        schema=os.environ.get("SNOWFLAKE_SCHEMA", "PUBLIC"),
        session_parameters={"QUERY_TAG": "weave-app"},
    )
```

```python
# app/repositories/analytics_repository.py
from contextlib import contextmanager
from snowflake.connector import DictCursor
from app.db.snowflake_client import get_connection


@contextmanager
def cursor():
    """Yields a DictCursor and auto-closes the connection."""
    conn = get_connection()
    try:
        with conn.cursor(DictCursor) as cur:
            yield cur
    finally:
        conn.close()


def get_customer_order_summary(customer_id: str, days: int = 30) -> list[dict]:
    """Parameter binding: %(name)s style — never interpolate user input."""
    sql = """
        SELECT
            DATE_TRUNC('day', o.created_at)  AS order_date,
            COUNT(*)                          AS order_count,
            SUM(o.total)                      AS revenue
        FROM   myapp_db.public.orders o
        WHERE  o.customer_id = %(customer_id)s
          AND  o.created_at  >= DATEADD('day', -%(days)s, CURRENT_TIMESTAMP())
          AND  o.status      != 'cancelled'
        GROUP BY 1
        ORDER BY 1 DESC
    """
    with cursor() as cur:
        cur.execute(sql, {"customer_id": customer_id, "days": days})
        return cur.fetchall()


def bulk_insert_events(events: list[dict]) -> None:
    """Use executemany for batch inserts — more efficient than looped execute."""
    sql = "INSERT INTO events (id, type, payload, ts) VALUES (%(id)s, %(type)s, %(payload)s, %(ts)s)"
    with cursor() as cur:
        cur.executemany(sql, events)
```

```python
# Snowpark: DataFrame operations on Unity-Catalog-style tables
from snowflake.snowpark import Session

def get_snowpark_session() -> Session:
    return Session.builder.configs({
        "account":   os.environ["SNOWFLAKE_ACCOUNT"],
        "user":      os.environ["SNOWFLAKE_USER"],
        "password":  os.environ["SNOWFLAKE_PASSWORD"],
        "warehouse": os.environ.get("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
        "database":  os.environ.get("SNOWFLAKE_DATABASE", "MYAPP_DB"),
        "schema":    os.environ.get("SNOWFLAKE_SCHEMA", "PUBLIC"),
    }).create()

def top_customers(n: int = 10):
    session = get_snowpark_session()
    try:
        return (
            session.table("orders")
            .filter("status != 'cancelled'")
            .group_by("customer_id")
            .agg({"total": "sum"})
            .sort("SUM(TOTAL)", ascending=False)
            .limit(n)
            .collect()
        )
    finally:
        session.close()
```

**Why:** `%(name)s` binding is SQL-injection-safe and Snowflake-native.
`DictCursor` returns rows as dicts, avoiding positional index errors.
Snowpark pushes computation to the warehouse instead of pulling data to Python.
