---
source: graph.json@{{GRAPH_SHA}}
confirmed_by: "none"
confirmed_on: null
last_verified_sha: {{HEAD_SHA}}
expires_on: {{EXPIRES_ON}}
owner: {{OWNER}}
coverage: {{COVERAGE_PCT}}
---
<!-- Frontmatter schema: templates/frontmatter-schema.md -->
<!-- Reader: ERD reflects code/schema shape only. Business invariants live in invariants.md — read both. -->
# Data Model (current state): {{PROJECT_NAME}}

> Coverage: {{COVERAGE_PCT}}% of LOC analysed{{COVERAGE_EXCLUSIONS}}
> **Must-read sibling:** [invariants.md](invariants.md) — the ERD does not capture tenancy, soft-delete, polymorphism, cross-table business rules, or migrations-in-flight.

## Entities (from graph)

```mermaid
erDiagram
    {{ENTITY_A}} ||--o{ {{ENTITY_B}} : "{{relationship}}"
    {{ENTITY_A}} {
        {{field_type}} {{field_name}} {{PK/FK/nullable}}
    }
    {{ENTITY_B}} {
        {{field_type}} {{field_name}}
    }
```

> Graph nodes: {{NODE_IDS}} · Source: {{ORM / migration files / schema dump path}}

## Entity table

| Entity | Purpose | Source file | Row-count order |
|---|---|---|---|
| {{ENTITY}} | {{purpose}} | `{{path}}` | {{<1k \| 1k-100k \| 100k-10M \| >10M}} |

## Storage

- **Database**: {{db_engine_and_version}}
- **Migrations directory**: `{{migrations_path}}`
- **Migration tool**: {{tool}}
- **Multi-tenancy**: {{none | row-level | schema-per-tenant | db-per-tenant}} — see invariants.md
- **Soft-delete**: {{not used | `deleted_at` column | tombstone table}} — see invariants.md

## Blind spots

<!-- Any ORM behaviour the graph can't see: STI/MTI, polymorphic associations, denormalised caches, shadow writes, cross-service references. -->

- {{blind_spot_1}}

## Archive
