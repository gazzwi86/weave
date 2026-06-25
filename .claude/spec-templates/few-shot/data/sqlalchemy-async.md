---
topic: data
stack: python
references:
  - docs/stack-equivalents.md
---

# SQLAlchemy 2.0 Async — Model + Repository + Alembic Migration

Python 3.12, SQLAlchemy 2.0 (async), asyncpg driver, Alembic 1.13.
Repository pattern isolates DB logic from the service layer.

```python
# app/models/order.py
import enum
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Enum, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("ix_orders_customer_status", "customer_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    customer_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.PENDING, nullable=False
    )
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc), nullable=False
    )

    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (UniqueConstraint("order_id", "sku_id"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    sku_id: Mapped[str] = mapped_column(String(64), nullable=False)
    qty: Mapped[int]
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    order: Mapped["Order"] = relationship("Order", back_populates="items")
```

```python
# app/repositories/order_repository.py
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.order import Order, OrderStatus


class OrderRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get(self, order_id: UUID) -> Order | None:
        stmt = (
            select(Order)
            .options(selectinload(Order.items))     # eager-load items in one query
            .where(Order.id == order_id)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_by_customer(self, customer_id: UUID) -> list[Order]:
        stmt = select(Order).where(Order.customer_id == customer_id)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def save(self, order: Order) -> Order:
        self._session.add(order)
        await self._session.flush()   # write without committing (service commits)
        return order
```

```python
# alembic/env.py — async-aware target_metadata
from app.models.order import Base
target_metadata = Base.metadata
# run_migrations_online uses AsyncEngine.connect()
```

```bash
# Generate migration after model change
alembic revision --autogenerate -m "add orders table"
alembic upgrade head
```

**Why:** `selectinload` issues a second SELECT with IN clause — better than
`joinedload` for one-to-many lists. `flush()` in the repo lets the service
layer control commit boundaries.
