---
topic: data
stack: ts
references:
  - docs/stack-equivalents.md
---

# Azure Cosmos DB SQL API — Document Model, Partition Key, Hierarchical PKs

@azure/cosmos 4.x, TypeScript. Hierarchical partition keys (GA 2024) reduce
cross-partition fan-out for multi-tenant / multi-region designs.

```ts
// src/db/cosmos-client.ts
import { CosmosClient, PartitionKeyDefinitionVersion, PartitionKeyKind } from "@azure/cosmos";

export const cosmos = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT ?? "https://myaccount.documents.azure.com:443/",
  key:      process.env.COSMOS_KEY ?? "base64key==",
});

// Hierarchical partition key: /tenantId → /customerId
// Queries scoped to tenant fan-out to 1 physical partition.
export const container = cosmos
  .database("myapp")
  .container("orders");

/** Call once during infra bootstrap — NOT on every app start. */
export async function ensureContainer(): Promise<void> {
  await cosmos.database("myapp").containers.createIfNotExists({
    id: "orders",
    partitionKey: {
      paths: ["/tenantId", "/customerId"],
      kind:    PartitionKeyKind.MultiHash,
      version: PartitionKeyDefinitionVersion.V2,
    },
    indexingPolicy: {
      indexingMode: "consistent",
      includedPaths: [{ path: "/*" }],
      excludedPaths: [{ path: "/items/*" }],   // large array — exclude from index
    },
    defaultTtl: -1,   // TTL enabled, item controls expiry via 'ttl' field
  });
}
```

```ts
// src/orders/order.repository.ts
import { container } from "../db/cosmos-client";

export interface CosmosOrder {
  id: string;              // Cosmos item id
  tenantId:   string;      // partition key level 1
  customerId: string;      // partition key level 2
  status: "pending" | "confirmed" | "shipped";
  total: number;
  createdAt: string;
  items: { skuId: string; qty: number; unitPrice: number }[];
  ttl?: number;            // optional: seconds until auto-delete
}

type PartitionKey = [string, string]; // [tenantId, customerId]

export async function upsertOrder(order: CosmosOrder): Promise<CosmosOrder> {
  const { resource } = await container.items.upsert<CosmosOrder>(order);
  if (!resource) throw new Error("upsert returned no resource");
  return resource;
}

export async function getOrder(id: string, pk: PartitionKey): Promise<CosmosOrder | null> {
  const { resource } = await container.item(id, pk).read<CosmosOrder>();
  return resource ?? null;
}

export async function listByCustomer(tenantId: string, customerId: string): Promise<CosmosOrder[]> {
  const query = {
    query: "SELECT * FROM c WHERE c.tenantId = @tid AND c.customerId = @cid ORDER BY c.createdAt DESC",
    parameters: [
      { name: "@tid", value: tenantId },
      { name: "@cid", value: customerId },
    ],
  };
  const { resources } = await container.items.query<CosmosOrder>(query).fetchAll();
  return resources;
}

export async function softDelete(id: string, pk: PartitionKey, ttlSeconds = 86_400): Promise<void> {
  // Set TTL to expire in 24 h — Cosmos deletes automatically
  await container.item(id, pk).patch([{ op: "add", path: "/ttl", value: ttlSeconds }]);
}
```

**Why:** Hierarchical PKs (`/tenantId` → `/customerId`) scope point reads to
one physical partition. Excluding `/items/*` from indexing cuts RU cost when
the array is large. `patch` for soft-delete avoids a full read-modify-write cycle.
