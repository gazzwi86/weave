---
topic: api
stack: python
references:
  - docs/stack-equivalents.md
---

# FastAPI — APIRouter with Pydantic, DI Session, HTTPException

FastAPI 0.115+, Python 3.12. `APIRouter` keeps route files focused.
The DB session is injected via `Depends`; never pass it as a plain argument.

```python
# app/routers/orders.py
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models.order import Order
from app.schemas.order import OrderCreate, OrderRead
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


# -- GET list -----------------------------------------------------------------
@router.get("/", response_model=list[OrderRead], summary="List orders for a customer")
async def list_orders(
    customer_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> list[Order]:
    svc = OrderService(session)
    return await svc.list_by_customer(customer_id)


# -- GET single ---------------------------------------------------------------
@router.get("/{order_id}", response_model=OrderRead)
async def get_order(
    order_id: UUID,
    session: AsyncSession = Depends(get_session),
) -> Order:
    svc = OrderService(session)
    order = await svc.get(order_id)
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="order not found")
    return order


# -- POST create --------------------------------------------------------------
@router.post("/", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    session: AsyncSession = Depends(get_session),
) -> Order:
    svc = OrderService(session)
    return await svc.create(payload)
```

```python
# app/schemas/order.py  — Pydantic v2
from pydantic import BaseModel, ConfigDict
from uuid import UUID
from enum import StrEnum

class OrderStatus(StrEnum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"

class OrderCreate(BaseModel):
    customer_id: UUID
    items: list[dict]  # refine to ItemCreate in real code

class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    customer_id: UUID
    status: OrderStatus
    total: float
```

```python
# app/db.py  — async session factory
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

engine = create_async_engine("postgresql+asyncpg://user:pass@localhost/mydb")
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session
```

**Why:** `Depends(get_session)` scopes the session to the request and closes it
automatically. `response_model` ensures the schema, not the ORM object, is
serialised — no accidental lazy-load leaks.
