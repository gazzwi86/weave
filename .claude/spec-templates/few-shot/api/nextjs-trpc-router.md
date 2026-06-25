---
topic: api
stack: ts
references:
  - docs/stack-equivalents.md
---

# Next.js + tRPC — Router, Caller Types, Mutation + Query

tRPC v11 with zod input schemas. Exposes typed procedures; the frontend gets
full end-to-end type safety with zero code generation.

```ts
// server/routers/order.ts
import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// -- input schemas ------------------------------------------------------------
const CreateOrderInput = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({ skuId: z.string(), qty: z.number().int().min(1) })),
});

const ListOrdersInput = z.object({
  customerId: z.string().uuid(),
  status: z.enum(["pending", "confirmed", "shipped"]).optional(),
  cursor: z.string().optional(),  // for pagination
});

// -- router -------------------------------------------------------------------
export const orderRouter = router({
  // query: read-only
  list: publicProcedure
    .input(ListOrdersInput)
    .query(async ({ input, ctx }) => {
      return ctx.db.order.findMany({
        where: { customerId: input.customerId, status: input.status },
        take: 20,
        cursor: input.cursor ? { id: input.cursor } : undefined,
      });
    }),

  // mutation: side-effect
  create: protectedProcedure
    .input(CreateOrderInput)
    .mutation(async ({ input, ctx }) => {
      if (ctx.user.id !== input.customerId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "not your order" });
      }
      return ctx.db.order.create({ data: input });
    }),
});

// -- type export (used by client) ---------------------------------------------
export type OrderRouter = typeof orderRouter;
```

```ts
// server/trpc.ts  — boilerplate, shown once
import { initTRPC, TRPCError } from "@trpc/server";
import { type Context } from "./context";
import superjson from "superjson";

const t = initTRPC.context<Context>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
// protectedProcedure: throw if no session
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
```

```ts
// client usage (React)
import { trpc } from "@/utils/trpc";

// TypeScript knows the return shape — no manual typing needed
const { data } = trpc.order.list.useQuery({ customerId: "uuid-here" });
const createOrder = trpc.order.create.useMutation();
```

**Why:** `protectedProcedure` centralises auth in one place. `TRPCError` maps
cleanly to HTTP codes. Input schemas are the single source of truth.
