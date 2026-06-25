---
topic: data
stack: ts
references:
  - docs/stack-equivalents.md
---

# Prisma Schema — Multi-table, Relations, Enum, Unique, Index, Cascade

Prisma 6, PostgreSQL. Covers the most common modelling patterns in one schema.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// -- enums --------------------------------------------------------------------
enum OrderStatus {
  PENDING
  CONFIRMED
  SHIPPED
  CANCELLED
}

// -- models -------------------------------------------------------------------
model Customer {
  id        String   @id @default(cuid())
  email     String   @unique                      // unique index
  name      String
  createdAt DateTime @default(now()) @map("created_at")
  orders    Order[]

  @@map("customers")                              // table name
}

model Order {
  id         String      @id @default(cuid())
  customerId String      @map("customer_id")
  status     OrderStatus @default(PENDING)
  total      Decimal     @db.Decimal(12, 2)
  createdAt  DateTime    @default(now()) @map("created_at")
  updatedAt  DateTime    @updatedAt @map("updated_at")

  customer   Customer    @relation(fields: [customerId], references: [id])
  items      OrderItem[]

  @@index([customerId, status])                  // composite index
  @@index([createdAt])
  @@map("orders")
}

model OrderItem {
  id       String  @id @default(cuid())
  orderId  String  @map("order_id")
  skuId    String  @map("sku_id")
  qty      Int
  unitPrice Decimal @db.Decimal(10, 2) @map("unit_price")

  order    Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)

  @@unique([orderId, skuId])                     // no duplicate SKU per order
  @@map("order_items")
}
```

```ts
// Usage — typed client
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient({ log: ["warn", "error"] });

// nested create
const order = await db.order.create({
  data: {
    customerId: "customer-id",
    items: { create: [{ skuId: "SKU-001", qty: 2, unitPrice: 9.99 }] },
  },
  include: { items: true },
});

// transaction
await db.$transaction(async (tx) => {
  await tx.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });
  // other writes here share the same connection
});
```

**Why:** `@@index` on `(customerId, status)` covers the most common list query.
`onDelete: Cascade` on `OrderItem` prevents orphaned rows. `Decimal` avoids
floating-point rounding on monetary values.
