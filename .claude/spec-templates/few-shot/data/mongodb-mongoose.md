---
topic: data
stack: ts
references:
  - docs/stack-equivalents.md
---

# Mongoose Schema — Indexes, Virtuals, Population, Zod-compatible Types

Mongoose 8, Node 20. Zod schema mirrors the Mongoose schema for request
validation; they're kept in sync manually (or via `zod-to-mongoose`).

```ts
// src/orders/order.model.ts
import { Schema, model, Types, Document } from "mongoose";

// -- subdocument --------------------------------------------------------------
const orderItemSchema = new Schema(
  {
    skuId:     { type: String, required: true },
    qty:       { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },   // no _id on subdocuments unless needed
);

// -- main schema --------------------------------------------------------------
const orderSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    status: {
      type:    String,
      enum:    ["pending", "confirmed", "shipped", "cancelled"],
      default: "pending",
      index:   true,
    },
    total:     { type: Number, default: 0, min: 0 },
    items:     { type: [orderItemSchema], default: [] },
  },
  {
    timestamps: true,   // adds createdAt + updatedAt automatically
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  },
);

// -- compound index -----------------------------------------------------------
orderSchema.index({ customerId: 1, status: 1 });
orderSchema.index({ createdAt: -1 });

// -- virtual: item count ------------------------------------------------------
orderSchema.virtual("itemCount").get(function (this: IOrder) {
  return this.items.length;
});

// -- TypeScript interface ------------------------------------------------------
export interface IOrder extends Document {
  customerId: Types.ObjectId;
  status: "pending" | "confirmed" | "shipped" | "cancelled";
  total: number;
  items: { skuId: string; qty: number; unitPrice: number }[];
  itemCount: number;   // virtual
  createdAt: Date;
  updatedAt: Date;
}

export const Order = model<IOrder>("Order", orderSchema);
```

```ts
// src/orders/order.repository.ts
import { Types } from "mongoose";
import { Order } from "./order.model";

export async function listByCustomer(customerId: string) {
  return Order
    .find({ customerId: new Types.ObjectId(customerId) })
    .populate("customerId", "name email")   // populate FK reference
    .sort({ createdAt: -1 })
    .lean();   // returns plain JS objects — faster, no Mongoose overhead
}

export async function createOrder(data: {
  customerId: string;
  items: { skuId: string; qty: number; unitPrice: number }[];
}) {
  const total = data.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  return Order.create({ ...data, total });
}
```

```ts
// Zod mirror for request validation (kept in sync with schema)
import { z } from "zod";

export const CreateOrderSchema = z.object({
  customerId: z.string().regex(/^[a-f\d]{24}$/i, "invalid ObjectId"),
  items: z.array(z.object({ skuId: z.string(), qty: z.number().int().min(1), unitPrice: z.number().min(0) })),
});
```

**Why:** `.lean()` on read-only queries skips Mongoose document hydration and
returns POJOs ~2× faster. `_id: false` on subdocuments saves storage when IDs
aren't needed. Virtuals require `toJSON: { virtuals: true }` to appear in
serialised output.
