---
topic: api
stack: ts
references:
  - docs/stack-equivalents.md
---

# Next.js App Router — Route Handler (GET + POST)

Minimal pattern: typed `NextRequest`/`NextResponse`, zod validation, error mapping.
Keep each handler ≤ 50 lines by extracting business logic to a service module.

```ts
// app/api/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// -- schemas ------------------------------------------------------------------
const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({ skuId: z.string(), qty: z.number().int().min(1) })),
});

const OrderResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "shipped"]),
  total: z.number(),
});

type OrderResponse = z.infer<typeof OrderResponseSchema>;

// -- GET ----------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const customerId = req.nextUrl.searchParams.get("customerId");
  if (!customerId) {
    return NextResponse.json({ error: "customerId required" }, { status: 400 });
  }
  try {
    // Replace with real service call
    const orders: OrderResponse[] = await fetchOrders(customerId);
    return NextResponse.json(orders, { status: 200 });
  } catch (err) {
    return mapError(err);
  }
}

// -- POST ---------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const order = await createOrder(parsed.data);
    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    return mapError(err);
  }
}

// -- helpers ------------------------------------------------------------------
function mapError(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("unhandled", err);
  return NextResponse.json({ error: "internal" }, { status: 500 });
}

class AppError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Stub — replace with real DB/service calls
async function fetchOrders(_cid: string): Promise<OrderResponse[]> { return []; }
async function createOrder(_d: z.infer<typeof CreateOrderSchema>): Promise<OrderResponse> {
  return { id: crypto.randomUUID(), status: "pending", total: 0 };
}
```

**Why:** `safeParse` keeps validation errors at the boundary. `mapError` prevents
leaking stack traces. Each verb stays well under 20 lines, satisfying Law E.
