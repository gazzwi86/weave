---
source: sme-interview
confirmed_by: "none"
confirmed_on: null
last_verified_sha: {{HEAD_SHA}}
expires_on: {{EXPIRES_ON}}
owner: {{OWNER}}
coverage: n/a
---
<!-- Frontmatter schema: templates/frontmatter-schema.md -->
<!-- Sibling of data-model.md. ERD says what the schema looks like; this file says what the schema MEANS. -->
# Data-model invariants: {{PROJECT_NAME}}

> **Required reading alongside [data-model.md](data-model.md).** The ERD is extracted from code; the rules below are extracted from humans.

## Tenancy

- **Scoping column(s)**: {{tenant_id | org_id | workspace_id | none}}
- **Rule**: every query against multi-tenant tables MUST filter on the scoping column. The ORM {{enforces this via / does not enforce this}}.
- **Cross-tenant operations**: {{never permitted | admin-only path | batch-job exception}}

## Soft-delete

- **Mechanism**: {{deleted_at timestamp | status column | tombstone table | not used}}
- **Affected tables**: {{list}}
- **Rule**: reads MUST exclude soft-deleted rows unless {{exception list}}.
- **Cascade behaviour**: {{children also soft-delete | children hard-delete | children orphan}}

## Polymorphic / STI / MTI associations

| Table | Discriminator | Concrete types | Notes |
|---|---|---|---|
| {{table}} | {{column}} | {{type1, type2}} | {{constraints, gotchas}} |

## Business-rule constraints enforced in application code

These are NOT `CHECK` constraints in the database — they are enforced by the app layer and will silently break if bypassed.

| Rule | Where enforced (file#symbol) | Consequence if violated |
|---|---|---|
| {{rule}} | `{{path#symbol}}` | {{what breaks}} |

## Migrations in flight

Columns or tables mid-transition — shadow writes, dual-read, pending drop. The ORM model may declare them but they should not be used.

| Column/Table | Status | Expected removal | Owner |
|---|---|---|---|
| {{item}} | {{shadow-write / dual-read / deprecated / pending-drop}} | {{date}} | {{owner}} |

## Denormalised caches

Columns that duplicate data for read-perf. Updates must happen in lockstep.

| Cached column | Source of truth | Refresh mechanism |
|---|---|---|
| {{col}} | {{src}} | {{trigger / cron / app-event}} |

## Cross-service references

Fields that hold IDs from another service's database. FK constraints are impossible; lifecycle is decoupled.

| Column | Foreign service | Consistency model |
|---|---|---|
| {{col}} | {{service}} | {{eventually-consistent / best-effort / strong-via-saga}} |

## Archive
