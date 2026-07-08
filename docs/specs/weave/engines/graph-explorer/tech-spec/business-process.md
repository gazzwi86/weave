---
type: TechSpec
title: "Graph Explorer — Business Process (M1)"
description: "Interaction flows, state machines, and sequence diagrams for the Graph Explorer
  engine in Milestone 1 (force canvas read + drill-in only)."
tags: [graph-explorer, arch, tech-spec, m1, business-process]
status: Draft
timestamp: 2026-07-01T00:00:00Z
resource: docs/specs/weave/engines/graph-explorer/tech-spec/business-process.md
source: hand-authored
confirmed_by: none
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: graph-explorer
---

# Graph Explorer — Business Process (M1)

**Engine spec:** [graph-explorer.md](../../graph-explorer.md)
**Inter-engine contracts:** [contracts.md](../../../contracts.md)
**Tenant isolation:** [ADR-001 — named-graph + query-rewriting](../../../decisions/ADR-001-tenant-isolation.md)
**Renderer strategy:** [ADR-001 (GE-local) — Cytoscape.js + fcose](../decisions/ADR-001-render-engine.md)

**Standards referenced (link, not restated):**

- RBAC levels: [rbac-multi-tenancy.md](../../../../../standards/rbac-multi-tenancy.md)
- API conventions (error envelope, pagination, status codes):
  [api-conventions.md](../../../../../standards/api-conventions.md)
- Audit / immutability: [audit-immutability.md](../../../../../standards/audit-immutability.md)
- Observability (traces, metrics): [observability.md](../../../../../standards/observability.md)
- Node kind visual palette: [data-viz.md](../../../../../standards/design/data-viz.md)

> **Renderer adapter invariant.** All diagrams below assume the renderer is accessed via the
> stable adapter interface (`load(elements)`, `onNodeClick(cb)`, `getViewport()`, `setLayout(name, opts)`,
> `pin(node)`). No task may call renderer APIs directly — this bound limits a Cytoscape → WebGL
> swap to ~25–35 % rework. See [GE ADR-001](../decisions/ADR-001-render-engine.md).

---

## Canvas Session State Machine

This is the top-level lifecycle of an Explorer canvas session, spanning all M1 flows:

```mermaid
stateDiagram-v2
    [*] --> Idle : route mounted

    Idle --> Loading : graph_id selected / route entered
    Loading --> Rendered : elements received + layout applied
    Loading --> LoadError : CE timeout / 4xx / 5xx

    LoadError --> Loading : user retries

    Rendered --> Interacting : click / drag / right-click / search
    Rendered --> Loading : graph_id changed (full reload)

    Interacting --> Persisting : drag-end (positions changed)
    Interacting --> Rendered : action complete (spotlight close, search clear, etc.)

    Persisting --> Rendered : positions saved (200 OK) or retry exhausted (toast)
```

> All detailed sub-flows are diagrammed in the sections below.

---

## Graph Load

End-to-end sequence from route entry through to the renderer receiving the first page of elements.
CE-READ-1 is the exclusive data source; all SPARQL queries pass through the CE query-rewriter
(tenant named-graph injected automatically — unscoped queries are fail-closed rejected).

```mermaid
sequenceDiagram
    actor User
    participant Canvas as ExplorerCanvas (React)
    participant Proxy as Next.js API Proxy
    participant Rewriter as CE Query Rewriter
    participant Store as RDF Store

    User->>Canvas: opens graph (graph_id)
    Canvas->>Proxy: GET /api/ontology/graph?graph_id=X&cursor=null
    Proxy->>Rewriter: SPARQL SELECT (tenant named-graph injected)
    Rewriter->>Store: scoped SELECT (urn:weave:g:tenant:{id} + framework)
    Store-->>Rewriter: rows {node_iri, bpmo_kind, label, source_iri, target_iri, predicate}
    Rewriter-->>Proxy: paginated result {nodes[], edges[], cursor, has_more_pages}
    Proxy-->>Canvas: 200 {nodes[], edges[], cursor, has_more_pages}
    Canvas->>Canvas: adapter.load(elements)
    Canvas-->>User: first-page canvas rendered

    loop has_more_pages = true
        Canvas->>Proxy: GET /api/ontology/graph?graph_id=X&cursor={cursor}
        Proxy->>Rewriter: next page SELECT
        Rewriter-->>Proxy: next page result
        Proxy-->>Canvas: 200 {nodes[], edges[], cursor, has_more_pages}
        Canvas->>Canvas: adapter.load(additional elements)
    end

    Canvas-->>User: full graph rendered
```

> CE-READ-1 SELECT is paginated (`cursor` + `has_more_pages`). `SERVICE` federation is blocked
> by the rewriter. Error handling for this sequence: see [#canvas-initial-load](#canvas-initial-load).

---

## Benchmark Decision

TASK-001 runs a benchmark spike on a 10k-node dataset to determine whether Cytoscape.js + fcose
meets the M1 performance targets. This state diagram shows the go/no-go gate and its consequences.

```mermaid
stateDiagram-v2
    [*] --> Spike : TASK-001 begins

    Spike --> Benchmarking : 10k-node synthetic dataset prepared

    Benchmarking --> GoDecision : benchmark measurements recorded

    state GoDecision <<choice>>

    GoDecision --> CytoscapeConfirmed : render ≤ 8s @ 10k nodes<br/>AND drag ≥ 60fps @ ≤ 1k visible
    GoDecision --> WebGLEscape : target missed on either metric

    CytoscapeConfirmed --> ADRAccepted : GE ADR-001 → Accepted (cytoscape+fcose)
    ADRAccepted --> [*] : TASK-002 AC-7 now assertable

    WebGLEscape --> RendererSwapADR : new ADR filed (sigma.js or G6)
    RendererSwapADR --> [*] : GE ADR-001 → Superseded<br/>TASK-002 AC-7 remains suspended
```

> **TASK-002 AC-7 is suspended until TASK-001 is signed off** (per GE ADR-001 Consequences).
> The engineer must not assert AC-7 until the benchmark completes. If WebGLEscape fires, the
> renderer adapter interface absorbs ~40–60 % rework in TASK-002 and ~25–35 % blended.

---

## Canvas Initial Load

Full load flow for the Explorer page, from route entry to idle-ready state. This includes
pre-loading the node-kind palette and saved layout positions before fetching graph data.

```mermaid
flowchart TD
    A([Route /explorer?graph_id=X]) --> B{JWT valid?}
    B -->|No| C[/Redirect to login/]
    B -->|Yes| D[Decode JWT — extract tenant_id + workspace_id]

    D --> E[GET /api/proxy/node-kinds — GE projection of<br/>CE-READ-1 /api/ontology/types — fetch BPMO kind palette]
    E --> F[GET /api/layout/positions?graph_id=X<br/>fetch saved Aurora positions]
    F --> G[GET /api/ontology/graph?graph_id=X<br/>page 1 via CE-READ-1]

    G --> H{CE response?}
    H -->|4xx / 5xx / timeout| I[Show CE error state<br/>Retry button visible]
    I -->|User retries| G

    H -->|200 — empty graph| J[Show empty-graph state<br/>"No nodes in this graph"]

    H -->|200 — nodes present| K[adapter.load elements]
    K --> L{Saved positions<br/>for this graph_id?}
    L -->|Yes — from Aurora| M[Apply saved positions<br/>pin each locked node]
    L -->|No — first load| N[Run fcose auto-layout]
    M --> O[Canvas rendered]
    N --> O

    O --> P{has_more_pages?}
    P -->|Yes| Q[Fetch next page<br/>append elements → adapter.load]
    Q --> P
    P -->|No| R([Canvas idle — awaiting interaction])
```

---

## Canvas Load State

State machine for the canvas loading and error lifecycle, corresponding to
[#canvas-initial-load](#canvas-initial-load):

```mermaid
stateDiagram-v2
    [*] --> Initialising : route mounted

    Initialising --> LoadingPalette : JWT decoded OK

    LoadingPalette --> LoadingPositions : palette received (or fallback #9CA3AF)

    LoadingPositions --> LoadingGraph : positions received (or 404 → no saved positions)

    LoadingGraph --> Rendering : CE page 1 OK
    LoadingGraph --> CEError : CE 4xx / 5xx / timeout

    CEError --> LoadingGraph : user retries

    Rendering --> Rendered : adapter.load() + layout applied

    Rendered --> LoadingGraph : more pages pending
    Rendered --> [*] : graph_id changed → full reload
```

---

## Spotlight Flow

When a user clicks a node, the canvas enters spotlight mode (closedNeighborhood at full opacity,
all other nodes dimmed) and the side panel fetches full properties from CE.

```mermaid
sequenceDiagram
    actor User
    participant Canvas as ExplorerCanvas
    participant Adapter as Renderer Adapter
    participant Proxy as Next.js Proxy
    participant CE as Constitution Engine

    User->>Adapter: click(node)
    Adapter->>Canvas: onNodeClick(node_iri)

    Canvas->>Canvas: compute closedNeighborhood(node_iri)
    Canvas->>Adapter: dim all non-neighbourhood nodes to opacity 0.18
    Canvas->>Canvas: open side panel → loading state

    Canvas->>Proxy: GET /api/ontology/resource/{node_iri}
    Proxy->>CE: CE-READ-1 resource detail (tenant-scoped)

    alt CE 200 OK
        CE-->>Proxy: {label, type_label, bpmo_kind, key_properties, iri}
        Proxy-->>Canvas: 200 resource detail
        Canvas->>Canvas: populate side panel
        Canvas-->>User: spotlight + populated side panel visible
    else CE 404 (cross-tenant IRI or deleted node)
        CE-->>Proxy: 404
        Proxy-->>Canvas: 404
        Canvas->>Canvas: side panel → error state ("not found")
        note over Canvas: 404 is the correct response — avoids leaking tenant existence
    else CE 5xx
        CE-->>Proxy: 5xx
        Proxy-->>Canvas: 5xx
        Canvas->>Canvas: side panel → error state ("failed to load")
    end

    User->>Canvas: click elsewhere / press ESC
    Canvas->>Adapter: reset all node opacity to 1.0
    Canvas->>Canvas: close side panel
```

> Raw IRI (`node_iri`) is shown only under the "Advanced" disclosure in the side panel and only
> for users with `ontologist` RBAC role ([rbac-multi-tenancy.md](../../../../../standards/rbac-multi-tenancy.md)).
> Opacity 0.18 for dimmed nodes is tunable via `config.spotlight_dim_opacity`.

---

## Side Panel States

State machine for the detail side panel, corresponding to [#spotlight-flow](#spotlight-flow):

```mermaid
stateDiagram-v2
    [*] --> Closed

    Closed --> Loading : node clicked (onNodeClick)

    Loading --> Loaded : CE resource detail received (200)
    Loading --> NotFound : CE returns 404
    Loading --> Error : CE returns 5xx

    Loaded --> Loading : different node clicked
    NotFound --> Loading : different node clicked
    Error --> Loading : different node clicked

    Loaded --> Closed : user closes panel (button / ESC)
    NotFound --> Closed : user closes panel (button / ESC)
    Error --> Closed : user closes panel (button / ESC)

    Closed --> [*] : canvas unmounted
```

---

## Layout Persist Flow

Server-side layout persistence: after a drag-end event, GE posts updated positions to Aurora.
The backend issues `SET LOCAL app.current_tenant_id` before the UPSERT to satisfy the RLS policy.
The client uses an optimistic hold with exponential-backoff retry.

```mermaid
sequenceDiagram
    actor User
    participant Canvas as ExplorerCanvas
    participant Adapter as Renderer Adapter
    participant Proxy as FastAPI Backend
    participant DB as Aurora PostgreSQL (RLS)

    User->>Adapter: drag-end (node released)
    Adapter->>Canvas: position change event {node_iri, x, y}

    Canvas->>Canvas: mark positions as pending (optimistic hold)

    Canvas->>Proxy: POST /api/layout/positions<br/>{graph_id, positions:[{node_iri, x, y}]}
    Proxy->>DB: BEGIN;<br/>SET LOCAL app.current_tenant_id = :tenant_id;
    Proxy->>DB: UPSERT explorer_layout_positions<br/>  (ON CONFLICT pk → DO UPDATE position_x, position_y, updated_at)
    DB-->>Proxy: 200 OK
    Proxy-->>Canvas: 200 OK
    Canvas->>Canvas: clear pending mark

    alt Network error / 5xx (retry loop)
        Proxy-->>Canvas: error
        Canvas->>Canvas: wait 2 s → retry
        Canvas->>Proxy: POST /api/layout/positions (retry 1)
        Proxy-->>Canvas: error
        Canvas->>Canvas: wait 4 s → retry
        Canvas->>Proxy: POST /api/layout/positions (retry 2)
        Proxy-->>Canvas: error
        Canvas->>Canvas: wait 8 s → retry
        Canvas->>Proxy: POST /api/layout/positions (retry 3)
        Proxy-->>Canvas: error
        Canvas->>Canvas: show toast "Layout not saved — drag again to retry"
        Canvas->>Canvas: clear pending mark
    end
```

> `GET /api/layout/positions?graph_id=X` is called during [#canvas-initial-load](#canvas-initial-load)
> to pre-load saved positions. `DELETE /api/layout/positions?graph_id=X` resets the layout for a
> graph (triggers fcose auto-layout on next load). The `locked` column is FALSE by default; the
> M1 API exposes no write path for it (M2 Saved Views only).

---

## Layout Load State

State machine for layout persistence lifecycle, corresponding to [#layout-persist-flow](#layout-persist-flow):

```mermaid
stateDiagram-v2
    [*] --> Clean

    Clean --> Dirty : drag-end event

    Dirty --> Persisting : POST /api/layout/positions

    Persisting --> Clean : 200 OK

    Persisting --> RetryPending : network error / 5xx

    RetryPending --> Persisting : retry attempt (backoff 2s / 4s / 8s)
    RetryPending --> Dirty : retries exhausted → toast shown

    Dirty --> Persisting : user drags another node (new POST)

    Clean --> [*] : canvas unmounted
```

---

## Drill-In Flow

Three sub-flows share the right-click context menu on a node: **Domain Focus**, **Neighbour
Expand/Collapse**, and **Impact Traversal**. Impact Traversal is OQ-09 gated.

```mermaid
flowchart TD
    A([Right-click node]) --> B{Context menu action}

    B -->|Focus: domain| DF1[SPARQL SELECT domain members<br/>via CE-READ-1 rewriter]
    DF1 --> DF2[Dim non-domain nodes to 0.18 opacity]
    DF2 --> DF3([Domain focus active])
    DF3 -->|Clear focus| DF4([Reset all node opacity to 1.0])

    B -->|Expand neighbours| EN1{Estimated new<br/>nodes ≤ 500?}
    EN1 -->|Yes| EN2[Fetch /api/ontology/resource/{iri}<br/>neighbours via CE-READ-1]
    EN1 -->|No| EN3[/Confirm dialog: Add ~N nodes?/]
    EN3 -->|Cancel| A
    EN3 -->|Confirm| EN2
    EN2 --> EN4[adapter.load new elements + sub-layout]
    EN4 --> EN5([Canvas updated])

    B -->|Collapse neighbours| CO1[Remove expanded neighbour elements]
    CO1 --> CO2([Canvas restored])

    B -->|Impact traversal| IT1{OQ-09 resolved?}
    IT1 -->|No — blocked| IT2[/TASK-005 AC-6 + AC-7 suspended/]
    IT1 -->|Yes| IT3[Load config.oq09_predicate_closure]
    IT3 --> IT4[SPARQL property-path SELECT<br/>depth cap=6, LIMIT=cap+1]
    IT4 --> IT5([Traversal overlay rendered])
    IT5 -->|Clear traversal| IT6([Overlay removed])
```

Impact traversal sequence (post-OQ-09 only):

```mermaid
sequenceDiagram
    actor User
    participant Canvas as ExplorerCanvas
    participant Proxy as Next.js Proxy
    participant CE as Constitution Engine

    User->>Canvas: right-click → Impact Traversal
    note over Canvas: predicate closure loaded from<br/>config.oq09_predicate_closure (NOT string literals)
    Canvas->>Proxy: GET /api/ontology/traverse<br/>?iri={iri}&depth=6
    Proxy->>CE: SPARQL property-path SELECT<br/>(predicates from closure, LIMIT=cap+1)
    CE-->>Proxy: traversal {nodes[], edges[], truncated}
    Proxy-->>Canvas: 200 traversal result

    Canvas->>Canvas: overlay traversal result on canvas

    alt truncated=true (result == cap+1 rows)
        Canvas-->>User: notice "Traversal result capped at depth 6"
    end
    Canvas-->>User: traversal overlay visible
```

> Depth cap (default 6) and node-expansion confirmation threshold (default 500) are tunable via
> config. The predicate closure (`config.oq09_predicate_closure`) MUST NOT be assembled from
> hard-coded string literals — it is populated at OQ-09 resolution by the CE team.

---

## Traversal Overlay State

State machine for the impact traversal overlay, corresponding to [#drill-in-flow](#drill-in-flow).
This flow is gated on OQ-09 resolution (TASK-005 AC-6 and AC-7 suspended until then):

```mermaid
stateDiagram-v2
    [*] --> OverlayIdle

    OverlayIdle --> OverlayLoading : Impact Traversal selected<br/>(OQ-09 predicate closure available)

    OverlayLoading --> OverlayActive : CE traversal result received
    OverlayLoading --> OverlayError : CE 4xx / 5xx / timeout

    OverlayActive --> OverlayIdle : user clears traversal
    OverlayActive --> OverlayLoading : user selects different root node

    OverlayError --> OverlayIdle : user dismisses error

    note right of OverlayLoading
        TASK-005 AC-6 and AC-7 blocked
        until OQ-09 predicate closure
        confirmed by CE team
    end note
```

---

## Deferred (M2+)

The following flows are **out of scope for M1** and must not appear in the M1 implementation:

| Flow | Milestone | Reason deferred |
|---|---|---|
| Graph-node editing (create / update / delete) | M2 | Requires CE-WRITE-1 |
| Saved views (named layout snapshots) | M2 | Requires `locked` positions + saved-view table (FR-028) |
| Async canvas share link | M2 | FR-023 |
| Overlay editor (decorators, comments) | M2 | FR-024 |
| GE-CANVAS-1 embeddable component (force mode) | M2 | Depends on stable M1 canvas (FR-034) |
| CE-DIFF-1 / VERSION-1 version spine | M2 | Not in M1 CE-READ-1 scope |
| C4 structured canvas mode | post-v1 | Separate layout engine |
| Real-time multi-user collab (Yjs CRDT) | post-v1 | CE-EVENT-1 + CRDT complexity |
| CE-EVENT-1 live graph push | post-v1 | Requires event bus integration |
