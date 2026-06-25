---
topic: data
stack: ts
references:
  - docs/stack-equivalents.md
---

# DynamoDB Single-Table Design — PK/SK, GSI1, GSI2, lib-dynamodb

AWS SDK v3 + `@aws-sdk/lib-dynamodb` DocumentClient (auto-marshalls JS types).
Design covers Order entity; access patterns drive the key scheme.

```
Access patterns
  1. Get order by ID            → PK=ORDER#<id>      SK=ORDER#<id>
  2. List orders by customer    → GSI1: PK=CUST#<id>  SK=ORDER#<createdAt>
  3. List orders by status      → GSI2: PK=STATUS#<s> SK=ORDER#<createdAt>
```

```ts
// src/db/dynamo-client.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const raw = new DynamoDBClient({ region: process.env.AWS_REGION ?? "ap-southeast-2" });
export const ddb = DynamoDBDocumentClient.from(raw, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE = process.env.DYNAMO_TABLE ?? "myapp";
```

```ts
// src/orders/order.repository.ts
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb, TABLE } from "../db/dynamo-client";

export interface OrderItem { skuId: string; qty: number; unitPrice: number; }

export interface Order {
  id: string;
  customerId: string;
  status: "pending" | "confirmed" | "shipped";
  total: number;
  createdAt: string; // ISO-8601
  items: OrderItem[];
}

// Keys helper — single source of truth for PK/SK patterns
function keys(order: Pick<Order, "id" | "customerId" | "status" | "createdAt">) {
  return {
    PK:       `ORDER#${order.id}`,
    SK:       `ORDER#${order.id}`,
    GSI1PK:   `CUST#${order.customerId}`,
    GSI1SK:   `ORDER#${order.createdAt}`,
    GSI2PK:   `STATUS#${order.status}`,
    GSI2SK:   `ORDER#${order.createdAt}`,
  };
}

export async function putOrder(order: Order): Promise<void> {
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: { ...order, ...keys(order), entityType: "ORDER" },
    ConditionExpression: "attribute_not_exists(PK)",   // prevent clobber
  }));
}

export async function getOrder(id: string): Promise<Order | null> {
  const res = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `ORDER#${id}`, SK: `ORDER#${id}` },
  }));
  return (res.Item as Order) ?? null;
}

export async function listOrdersByCustomer(customerId: string): Promise<Order[]> {
  const res = await ddb.send(new QueryCommand({
    TableName:              TABLE,
    IndexName:              "GSI1",
    KeyConditionExpression: "GSI1PK = :pk AND begins_with(GSI1SK, :prefix)",
    ExpressionAttributeValues: {
      ":pk":     `CUST#${customerId}`,
      ":prefix": "ORDER#",
    },
    ScanIndexForward: false,   // newest first
  }));
  return (res.Items ?? []) as Order[];
}

export async function updateStatus(id: string, status: Order["status"]): Promise<void> {
  await ddb.send(new UpdateCommand({
    TableName:                 TABLE,
    Key: { PK: `ORDER#${id}`, SK: `ORDER#${id}` },
    UpdateExpression:          "SET #s = :s, GSI2PK = :gsi2pk",
    ExpressionAttributeNames:  { "#s": "status" },
    ExpressionAttributeValues: { ":s": status, ":gsi2pk": `STATUS#${status}` },
  }));
}
```

**Why:** The `keys()` helper centralises PK/SK derivation — change the pattern
once, not at every call site. `ConditionExpression` on `put` prevents silent
overwrites. `begins_with` on the SK prefix is safer than `=` when the SK embeds
a timestamp that may drift.
