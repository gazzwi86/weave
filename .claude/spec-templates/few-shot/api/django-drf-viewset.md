---
topic: api
stack: python
references:
  - docs/stack-equivalents.md
---

# Django REST Framework — ModelViewSet + drf-spectacular OpenAPI

Django 5, DRF 3.15, drf-spectacular 0.27. `ModelViewSet` gives CRUD for free;
override only the actions that need custom logic.

```python
# orders/views.py
from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiParameter
from django_filters.rest_framework import DjangoFilterBackend

from .models import Order
from .serializers import OrderSerializer, OrderCreateSerializer
from .pagination import StandardResultsPagination


@extend_schema(tags=["orders"])
class OrderViewSet(viewsets.ModelViewSet):
    """CRUD for customer orders."""

    queryset = Order.objects.select_related("customer").prefetch_related("items")
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = StandardResultsPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ["status", "customer_id"]
    ordering_fields = ["created_at", "total"]
    ordering = ["-created_at"]

    def get_serializer_class(self):
        if self.action == "create":
            return OrderCreateSerializer
        return OrderSerializer

    @extend_schema(
        parameters=[OpenApiParameter("customer_id", str, description="Filter by customer")],
        responses={200: OrderSerializer(many=True)},
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(summary="Confirm a pending order")
    @action(detail=True, methods=["post"], url_path="confirm")
    def confirm(self, request, pk=None):
        order = self.get_object()
        order.confirm()          # domain method on model
        return Response(OrderSerializer(order).data)
```

```python
# orders/serializers.py
from rest_framework import serializers
from .models import Order, OrderItem

class OrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrderItem
        fields = ["sku_id", "qty", "unit_price"]

class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = ["id", "customer_id", "status", "total", "items", "created_at"]
        read_only_fields = ["id", "total", "created_at"]

class OrderCreateSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True)

    class Meta:
        model = Order
        fields = ["customer_id", "items"]

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        order = Order.objects.create(**validated_data)
        OrderItem.objects.bulk_create(
            [OrderItem(order=order, **i) for i in items_data]
        )
        return order
```

```python
# orders/pagination.py
from rest_framework.pagination import CursorPagination

class StandardResultsPagination(CursorPagination):
    page_size = 20
    ordering = "-created_at"
```

**Why:** `select_related` / `prefetch_related` on the queryset avoids N+1 on
list. Separate `OrderCreateSerializer` prevents mass-assignment on update.
`drf-spectacular` decorators produce accurate OpenAPI 3.1 without extra effort.
