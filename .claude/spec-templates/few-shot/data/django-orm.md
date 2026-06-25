---
topic: data
stack: python
references:
  - docs/stack-equivalents.md
---

# Django ORM — Models, select_related, prefetch_related, Custom Manager

Django 5, Python 3.12. Custom manager keeps complex query logic out of views.
`select_related` and `prefetch_related` eliminate N+1 at the queryset level.

```python
# orders/models.py
import uuid
from decimal import Decimal
from django.db import models


class OrderStatus(models.TextChoices):
    PENDING   = "pending",   "Pending"
    CONFIRMED = "confirmed", "Confirmed"
    SHIPPED   = "shipped",   "Shipped"


class ActiveOrderManager(models.Manager):
    """Returns only non-cancelled orders — the 90 % case."""

    def get_queryset(self):
        return super().get_queryset().exclude(status="cancelled")

    def for_customer(self, customer_id: uuid.UUID):
        """Single call: customer's active orders with items pre-loaded."""
        return (
            self.get_queryset()
            .filter(customer_id=customer_id)
            .select_related("customer")          # JOIN for FK (1-to-1 / many-to-1)
            .prefetch_related("items")           # separate query with IN (1-to-many)
            .order_by("-created_at")
        )


class Order(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer   = models.ForeignKey(
        "customers.Customer", on_delete=models.PROTECT, related_name="orders"
    )
    status     = models.CharField(max_length=20, choices=OrderStatus, default=OrderStatus.PENDING)
    total      = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # two managers: default (all) + active (filtered)
    objects = models.Manager()
    active  = ActiveOrderManager()

    class Meta:
        db_table  = "orders"
        indexes   = [models.Index(fields=["customer", "status"])]
        ordering  = ["-created_at"]

    def confirm(self) -> None:
        """Domain method: transition pending → confirmed."""
        if self.status != OrderStatus.PENDING:
            raise ValueError(f"Cannot confirm order in status {self.status}")
        self.status = OrderStatus.CONFIRMED
        self.save(update_fields=["status", "updated_at"])


class OrderItem(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order      = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    sku_id     = models.CharField(max_length=64)
    qty        = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "order_items"
        unique_together = [("order", "sku_id")]
```

```python
# Usage in a view/service
from orders.models import Order

# No N+1 — items loaded in two queries total
orders = Order.active.for_customer(customer_id)

for order in orders:
    # safe — items already prefetched
    line_count = order.items.count()
```

**Why:** `select_related` is a JOIN (use for FK/OneToOne); `prefetch_related`
uses a separate IN query (use for reverse FK / M2M). Mixing them incorrectly
is the primary Django N+1 source. Domain methods like `confirm()` belong on
the model, not scattered across views.
