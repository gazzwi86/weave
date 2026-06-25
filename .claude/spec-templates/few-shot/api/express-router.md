---
topic: api
stack: ts
references:
  - docs/stack-equivalents.md
---

# Express Router — Zod Middleware, Async Wrapper, Typed Handlers

Node 20, Express 5, zod 3. `asyncWrap` prevents unhandled-rejection crashes.
Validation middleware is reusable; handler bodies stay business-logic only.

```ts
// src/orders/router.ts
import { Router } from "express";
import { z } from "zod";
import { asyncWrap, validate } from "../middleware";
import { OrderService } from "./order.service";

export const orderRouter = Router();
const svc = new OrderService();

// -- schemas ------------------------------------------------------------------
const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({ skuId: z.string(), qty: z.number().int().min(1) })),
});

// -- routes -------------------------------------------------------------------
orderRouter.get(
  "/",
  asyncWrap(async (req, res) => {
    const { customerId } = req.query as { customerId?: string };
    if (!customerId) return res.status(400).json({ error: "customerId required" });
    const orders = await svc.listByCustomer(customerId);
    res.json(orders);
  }),
);

orderRouter.post(
  "/",
  validate(CreateOrderSchema),   // zod middleware, sets req.body to parsed value
  asyncWrap(async (req, res) => {
    const order = await svc.create(req.body);
    res.status(201).json(order);
  }),
);
```

```ts
// src/middleware/validate.ts
import type { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(422).json({ error: result.error.flatten() });
    }
    req.body = result.data;  // replace raw body with typed, parsed value
    next();
  };
}
```

```ts
// src/middleware/async-wrap.ts
import type { Request, Response, NextFunction, RequestHandler } from "express";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps async route handlers so Express 5 + catches thrown errors. */
export function asyncWrap(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => fn(req, res, next).catch(next);
}
```

```ts
// src/middleware/error-handler.ts  — mount last
import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof AppError ? err.status : 500;
  const message = err instanceof Error ? err.message : "internal";
  res.status(status).json({ error: message });
}

export class AppError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}
```

```ts
// supertest usage (Vitest)
import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("POST /orders", () => {
  it("returns 422 for missing customerId", async () => {
    const res = await request(app).post("/orders").send({ items: [] });
    expect(res.status).toBe(422);
  });
});
```

**Why:** `asyncWrap` makes Express 5 + compatible and avoids `.catch(next)` noise
on every handler. `validate` is the single place that touches raw user input.
