---
type: Coding Standard
title: RBAC & Multi-Tenancy — Coding Standard
description: "Authorization model, tenant-scoping enforcement across relational/RDF/CRDT layers, and service-principal identity conventions for all Weave engines."
tags: [standards, rbac, multi-tenancy, security, isolation]
timestamp: 2026-06-30T00:00:00Z
resource: docs/standards/rbac-multi-tenancy.md
---

# RBAC & Multi-Tenancy Standards

Weave is a multi-tenant cloud SaaS. Every engine (Constitution, Build, Events,
Explorer) and the platform layer share one authorization model and one tenant-isolation
contract. These rules gate generated code: a route, store method, or sync room that
does not enforce them is a defect.

Grounded in the platform PRD Epic 3 (Tenancy), Epic 4 (Auth/RBAC/Identity), §6
(Isolation & data safety), and FR-020 through FR-025.

## Authorization model

### Permission levels

Roles grant one of four ordered permission levels, **per engine/area** (PRD §2,
FR-024). Higher levels subsume lower ones.

| Level | Grants | Example |
|-------|--------|---------|
| `read` | View entities, run SELECT queries, read audit | Compliance officer reads audit feed |
| `author` | `read` + create/edit instance data, run automations | Business analyst edits a node |
| `publish` | `author` + publish ontology versions / widget library | Enterprise architect ships a version |
| `admin` | `publish` + manage members, roles, connectors, settings | Workspace admin invites a user |

`platform-internal` is a **Weave-internal identity only** (Weave platform operator).
It never appears in a client workspace's RBAC and must never be assignable to a
client-tenant role. Generated RBAC code that exposes `platform-internal` to a tenant
surface is a defect (FR-043: client-tenant attempt → 403 + logged).

### Resolution

Effective role membership is resolved through the 4-level settings cascade
(`PLAT-SETTINGS-1`: Company → Domain → Workspace → Project, tighter-wins, FR-022).
Code must **not** hardcode role tables — call the settings-resolution API and act on
the returned effective level. Loosening a permission at a child node requires parent
approval; do not implement local overrides that widen access.

### Enforcement at the API boundary

RBAC is enforced **server-side at the API boundary**, never client-side (FR-024).
Every request carries a Cognito JWT; the platform validates role membership and
rejects unauthorised operations with **HTTP 403**, and the denial is recorded to
`PLAT-AUDIT-1` (PRD §6 Security; FR-024, E5-S1).

```python
# FastAPI dependency — every mutating/reading route declares the level it needs.
def require(level: PermissionLevel, area: Area):
    def _dep(ctx: RequestContext = Depends(get_context)) -> RequestContext:
        if not ctx.principal.has(level, area):
            audit.record(event_type="rbac.denied", actor=ctx.principal.iri,
                         target=area, engine=ctx.engine)
            raise HTTPException(status_code=403, detail="Insufficient permission.")
        return ctx
    return _dep


@router.post("/widgets", status_code=201)
def publish_widget(ctx: RequestContext = Depends(require("publish", "dashboard"))):
    ...
```

**Rules:**

- Every route declares its required `(level, area)` via the dependency — no implicit
  "logged-in means allowed".
- A 403 denial **always** writes a `PLAT-AUDIT-1` entry before raising.
- Routing a user to a missing area returns a **403 state**, not a blank shell, and
  audits the denial (E5-S1).
- Client-side gating is for UX only; it is never the security boundary.

### Revocation

Member removal or a role change is enforced by **one** mechanism (FR-021 reconciled
with FR-024): short access-token TTL (default ≤ 60 s, tunable) **plus** a per-request
session-version check against a revocation list. The next request bearing a stale
token is rejected within the bounded latency. Do not implement a second "immediate"
path — there is one mechanism and one latency.

**Test (mandatory):** after a member is removed, the next request with their prior
token is rejected within the bounded latency.

## Tenant-scoping enforcement

The isolation expectation and its test are **fixed**; the final RDF mechanism is an
Architect decision (PRD OQ-01 / CE OQ-04). Generated code targets the contract below
regardless of which RDF option is chosen.

### Relational layer (Aurora)

Every tenant-owned table carries a `tenant_id` column. Scoping is enforced in a
**base query layer**, not ad-hoc per query (PRD §6).

```python
# All tenant-scoped reads go through a base session bound to the request tenant.
# The predicate is injected centrally — never left to the call site.
stmt = select(Widget).where(Widget.tenant_id == ctx.tenant_id)
```

- No raw query may omit the `tenant_id` predicate. Use the scoped session/repository
  base class; do not issue bare `session.execute(text(...))` against tenant tables.
- Use parameterised queries — never concatenate `tenant_id` into SQL (see
  `rules/security.md`).
- S3 Vectors are **tenant-prefixed**; a vector read/write must include the tenant
  prefix (PRD §6).

### RDF layer (Oxigraph → Neptune/Fuseki)

One of two mechanisms (final choice = Architect, OQ-01):

1. **Store-per-tenant** — each tenant gets an isolated graph store. This is the
   prototype's proven model: `ProjectManager` opens one `OntologyStore` per project
   (`prototypes/weave-prototype/backend/app/projects/manager.py`), and routes resolve
   the store by id, returning **404 for an unknown id**
   (`prototypes/weave-prototype/backend/app/api/routes.py:129-138`). Favoured if
   query-rewriting proves fragile (CE risk table).

2. **Named-graph-per-tenant + mandatory query-rewriting** — a middleware injects the
   tenant named-graph scope into every query and **REJECTS any unscoped query** (no
   tenant predicate ⇒ query refused; never silently broadened — PRD §6).

Both inherit the CE SPARQL surface (decision B3, grounded in the prototype sanitizer
`store.py:581-603`):

- **SELECT-only.** UPDATE/INSERT/DELETE rejected pre-execution. Writes go only through
  `CE-WRITE-1` / `OntologyStore` methods (never raw triple writes — see the prototype
  `no-direct-rdf` rule).
- **`SERVICE` blocked** (SSRF vector) — rejected before reaching the store.
- **Paginated**, no silent row cap (the prototype caps at 500 rows; the product
  paginates instead of silently truncating).

```python
def assert_safe_sparql(query: str) -> None:
    stripped = query.strip().lstrip()
    if not re.match(r"(?i)(PREFIX\s.*?\s)*SELECT\s", stripped):
        raise ValueError("Only SELECT queries are supported.")
    if re.search(r"\bSERVICE\b", query, re.IGNORECASE):
        raise ValueError("SERVICE (federated) queries are not supported.")
```

The platform itself **never issues unscoped or `SERVICE` queries** (PRD §6).

### CRDT layer (realtime collaboration — Explorer, Phase 2)

Ephemeral canvas/presence state syncs via Yjs CRDT; authoritative writes still
serialise through `CE-WRITE-1` (Explorer E6-S4).

- The sync **room id includes the tenant id**. On connect, the sync server validates
  the Cognito JWT tenant claim against the room id; a **tenant mismatch is rejected at
  connect** (Explorer E6-S4 security AC, finding #8). Client-side gating is never the
  boundary.
- On transport drop, local edits replay and converge with no lost updates;
  duplicate-IRI creates reconcile at `CE-WRITE-1`.

## Service-principal identity (`PLAT-IDENTITY-1`)

Agents and automations act under named, least-privilege **service principals** minted
by the registry (FR-025). Conventions:

- The registry reconciles Platform agent classes + Build's dark-factory roles +
  Events' per-automation principals into **one canonical principal IRI**.
- The canonical principal IRI appears in **PROV-O** and in **every `PLAT-AUDIT-1`
  entry** the principal generates.
- **Two distinct auth paths, never mixed:**
  - Human → **Cognito** (JWT).
  - Machine (agent) → **IAM role assumed via STS** (short-lived credentials; never raw
    secret values). The registry records which IAM role maps to which canonical
    principal IRI and to which RBAC role at the Weave API boundary.
- A principal attempting an out-of-scope action is **denied (least-privilege) and
  logged** to `PLAT-AUDIT-1` (E4-S3 failure AC).
- Secrets are read from **AWS Secrets Manager only** — never raw secret values passed
  to a principal, never logged (PRD §6; `rules/security.md`).

## The cross-tenant-read test (mandatory gate)

Every engine that stores tenant data MUST ship this test; it is a release gate
(PRD §6, FR-020, CE acceptance):

1. Seed data into tenant A and tenant B.
2. Issue a query in **tenant A's context**.
3. Assert it returns **zero rows** from tenant B's data — across **RDF, Aurora, and
   S3 Vectors**.
4. Assert an **unscoped SPARQL query is rejected** (not silently broadened).
5. Assert an unauthorised workspace switch returns **HTTP 403** and loads **zero
   cross-tenant data** (FR-020).

```python
def test_cross_tenant_read_returns_zero_rows(seed_two_tenants):
    a, b = seed_two_tenants
    rows = query_in_context(tenant=a, sparql="SELECT ?n WHERE { ?n a weave:System }")
    assert all(r["tenant"] == a.id for r in rows)
    assert not any(r["tenant"] == b.id for r in rows)

def test_unscoped_query_is_rejected(tenant_a):
    with pytest.raises(UnscopedQueryRejected):
        run_unscoped(tenant_a, "SELECT ?s ?p ?o WHERE { ?s ?p ?o }")
```

## Checklist (generated code must satisfy)

- [ ] Every API route declares a required `(level, area)`; no implicit allow.
- [ ] Unauthorised op → HTTP 403 **and** a `PLAT-AUDIT-1` entry.
- [ ] No tenant-scoped Aurora query omits the `tenant_id` predicate; it is injected by
      the base layer, parameterised.
- [ ] SPARQL surface is SELECT-only, `SERVICE`-blocked, paginated; writes only via the
      store API.
- [ ] CRDT room id carries the tenant id; tenant claim validated at connect.
- [ ] Agent actions carry a canonical principal IRI in PROV-O + every audit entry;
      machine auth via IAM/STS, never Cognito.
- [ ] The cross-tenant-read test exists and passes for the engine's storage.
