---
name: arch-contracts
description: Produce the OpenAPI 3.1.0 spec (openapi.yaml, FastAPI + Pydantic v2, HITL batches of 3-5 endpoints) and the data-model.md tech-spec artifact (relational layer via Aurora/SQLAlchemy, semantic web layer via OWL/Oxigraph/SHACL) for a Weave entity. Invoked by the architect agent, one section/batch at a time with HITL review.
---

# arch-contracts Skill

Produce the two contract-level tech-spec artifacts for a Weave entity: the OpenAPI spec and the
data model. Invoked by the Architect agent once upstream specs (PRD, and `architecture.md` if
present) are approved. Both parts are delivered incrementally — OpenAPI in HITL batches of 3-5
endpoints, the data model one section at a time — never as a single dump.

Run the two parts in this order:

1. **Part 1 — OpenAPI Spec** (`openapi.yaml`) — OpenAPI 3.1.0 targeting FastAPI + Pydantic v2:
   security schemes, endpoint batches with EARS acceptance criteria, request/response schemas,
   shared error components.
2. **Part 2 — Data Model** (`data-model.md`) — the relational layer (Aurora PostgreSQL via
   SQLAlchemy async) and the semantic web layer (OWL 2 DL / Oxigraph / SHACL), including
   migration and cross-layer IRI conventions.

Each part below keeps its own Model tier, Input list, numbered Instructions, constitutional
self-check, confidence-block rules, Output/frontmatter spec, and Evaluation Criteria — these are
self-contained per part and are not shared across parts. Keep Pydantic schemas in Part 1 and
SQLAlchemy models in Part 2 consistent where they describe the same entities.

---

## Part 1: OpenAPI Spec

### Model

- **All phases:** claude-sonnet-5 (structured output, schema precision, YAML accuracy)

No elicitation phase for this skill — inputs come from approved upstream specs. If the
upstream tech-spec or PRD is missing, STOP and ask the user to run `/architect` first.

### Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave confirmed stack, Agent Laws A–F
2. `.claude/spec-templates/architecture/openapi.yaml` — section scaffold and metadata
   header (never leave `{{}}` placeholders in output)
3. `docs/standards/patterns/api/fastapi-router.md` — FastAPI + Pydantic v2
   patterns (operationId style, response_model conventions, error handling)
4. `docs/specs/weave/engines/<entity>/tech-spec/architecture.md` (if present) — resource list, auth
   approach, non-functional requirements
5. `docs/specs/weave/engines/<entity>.md` (if present) — user stories that drive endpoint
   shape
6. Any existing `openapi.yaml` draft at `docs/specs/weave/engines/<entity>/tech-spec/openapi.yaml`
   to continue rather than overwrite

Ask the user which entity this spec is for (e.g. `constitution-engine`, `build-engine`,
`weave-platform`) if not supplied. Confirm the base URL and environment (dev / staging /
prod) before writing the `servers` block.

### Instructions

#### Step 0 — State the governing principle (never skip)

Write 2–3 sentences naming the principle that governs an OpenAPI spec before writing
anything else.

Example: "An OpenAPI spec is a contract, not documentation. Every endpoint must be
implementable directly from this file without reading source code. Every schema must be
Pydantic-model-ready: snake_case fields, explicit types, no `additionalProperties: true`
unless justified."

Reference this principle when resolving schema ambiguities during the HITL loop.

#### Step 1 — Context ingestion

1. Read all files listed in the Input section above.
2. Summarise what you know in 3 bullets before writing the first YAML block:
   - What resources/entities this API exposes (from tech-spec or PRD)
   - What authentication scheme is confirmed (Cognito JWT or Auth0 JWT)
   - What graph/SPARQL endpoints are required (ontology queries, triple writes)

Ask via AskUserQuestion:
- "Which entity is this OpenAPI spec for?"
  Options (supply as free text): e.g. `constitution-engine`, `build-engine`, `weave-platform`

Then ask:
- "What is the base URL for the primary environment?"
  Options: `http://localhost:8000` / `https://api.dev.weave.internal` / Custom

#### Step 2 — Enumerate resources

Before writing any YAML, list the planned resource groups as a Markdown table:

| Resource Group | Endpoints (rough) | Notes |
|---|---|---|
| `<resource>` | GET list, GET by ID, POST, PUT, DELETE | e.g. Ontology triples |

Ask via AskUserQuestion:
- "Does this resource list look complete?"
  Options: Looks good / Add a resource / Remove a resource / Reorder

Amend until approved. This table is chat-only — it does not go in the YAML file.

#### Step 3 — Section-by-section YAML production

Produce the spec in this exact order. For each section or endpoint batch:

1. **Write** the YAML block to the file
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated
3. **Present** the written YAML to the user in a fenced `yaml` code block
4. **Emit a confidence block** (see below) immediately before the HITL question
5. **Ask** via AskUserQuestion: Approve / Amend / Reject
6. If Amend: apply changes, show a diff, re-present with updated confidence block
7. If Reject: regenerate cleanly, show the new version

##### Phase A — File header

Write the metadata comment block and `openapi`, `info`, and `servers` sections.

```yaml
# ---
# source: sme-authored-stub
# confirmed_by: "<name>"
# confirmed_on: <YYYY-MM-DD>
# last_verified_sha: <HEAD_SHA>
# expires_on: <YYYY-MM-DD + 90 days>
# owner: <team or squad>
# coverage: 0%
# _AUTO: false
# ---

openapi: 3.1.0
info:
  title: <Entity Display Name> API
  version: 0.1.0
  description: |
    <One-paragraph description of what this API does and who it serves.>
    Implementation target: FastAPI 0.115+ / Pydantic v2 / Python 3.12.

servers:
  - url: <base_url>
    description: <environment label>
```

Rules:
- `version` starts at `0.1.0` for pre-GA specs; bump to `1.0.0` at first prod deployment.
- `description` must identify the FastAPI/Pydantic v2 implementation target.
- Include `x-weave-entity: <entity>` as a top-level extension field.

##### Phase B — Security schemes

Write the `components/securitySchemes` block and the top-level `security` declaration.

```yaml
components:
  securitySchemes:
    CognitoJWT:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        AWS Cognito-issued JWT. Validate using the JWKS endpoint:
        https://cognito-idp.<region>.amazonaws.com/<userPoolId>/.well-known/jwks.json
        Verify: iss, aud (client_id), exp. Do NOT accept unsigned tokens.
    Auth0JWT:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: |
        Auth0-issued JWT (multi-IdP path). Validate using:
        https://<tenant>.auth0.com/.well-known/jwks.json
        Verify: iss, aud, exp. Do NOT accept unsigned tokens.

security:
  - CognitoJWT: []
```

Rules:
- Include both `CognitoJWT` and `Auth0JWT` schemes (multi-IdP is a confirmed requirement).
- Default top-level security to `CognitoJWT`; individual endpoints may override.
- Endpoints that are intentionally public must declare `security: []` explicitly.

##### Phase C — Endpoint batches (3–5 endpoints per HITL round)

Produce endpoints in resource-group order, 3–5 per HITL batch. Never dump all endpoints
at once.

For every endpoint, write an EARS acceptance criterion **before** the YAML block. This
is the behavioural contract that the QA skill and task-brief skill will reference.

Format:

```
EARS — <operationId>:
WHEN <actor> calls <METHOD> <path> with a <valid | invalid> payload
THE SYSTEM SHALL <expected behaviour> within <latency budget, e.g. 500ms>.
```

Examples:

```
EARS — createOntologyTriple:
WHEN an authenticated user POSTs a valid RDF triple to /ontology/triples
THE SYSTEM SHALL persist it to the RDF store and return HTTP 201 within 500ms.

EARS — executeSparqlQuery:
WHEN an authenticated user POSTs a valid SPARQL SELECT query to /sparql
THE SYSTEM SHALL return a W3C-compliant SPARQL Results JSON body with HTTP 200 within 2s.

EARS — createOntologyTriple (invalid):
WHEN a user POSTs a triple missing the required predicate field
THE SYSTEM SHALL return HTTP 422 with a ProblemDetails body within 200ms.
```

EARS statements live in chat only — do not embed them in the YAML file. They are inputs
to the downstream `/arch-task-brief` and `/qa` skills.

For every endpoint include **all** of:
- `operationId` — camelCase, format: `<verb><Resource>` (e.g. `listOntologyTriples`,
  `createOntologyTriple`, `deleteOntologyTriple`)
- `summary` — one imperative sentence (e.g. "List ontology triples for a named graph")
- `tags` — matches the resource group name
- `parameters` — path params, query params, all with `schema` and `description`
- `requestBody` — for POST/PUT/PATCH, with `required: true` and `application/json` content
- `responses`:
  - `200` or `201`: full schema ref
  - `400`: Problem Details (RFC 7807) — use `$ref: '#/components/schemas/ProblemDetails'`
  - `401`: authentication failure
  - `403`: authorisation failure (if applicable)
  - `404`: not found (if applicable)
  - `422`: validation error (FastAPI unprocessable entity)
  - `500`: internal server error

**SPARQL endpoint pattern** (mandatory for graph/ontology APIs):

```yaml
  /sparql:
    post:
      operationId: executeSparqlQuery
      summary: Execute a SPARQL 1.1 SELECT or CONSTRUCT query
      tags:
        - graph
      security:
        - CognitoJWT: []
      requestBody:
        required: true
        content:
          application/sparql-query:
            schema:
              type: string
              example: "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"
      responses:
        '200':
          description: SPARQL results in JSON binding format (W3C SPARQL 1.1 Results)
          content:
            application/sparql-results+json:
              schema:
                $ref: '#/components/schemas/SparqlResultSet'
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '500':
          $ref: '#/components/responses/InternalServerError'
```

Include the SPARQL endpoint whenever the entity involves ontology queries, graph
traversal, or RDF triple reads. Default to `POST /sparql` with
`application/sparql-query` body. Do NOT use query parameters for SPARQL strings.

##### Phase D — Request/response schemas

Write all `components/schemas` referenced by the endpoints. Produce in batches matching
the endpoint batches above. One HITL per batch.

Rules for Pydantic v2 compatibility:
- All field names **snake_case** — never camelCase in schema property names.
- Add `x-python-type` extension on fields that map to non-trivial Python types
  (e.g. `UUID`, `datetime`, `HttpUrl`, custom enums).
- Use `format: uuid` for UUID fields, `format: date-time` for datetime fields.
- Never use `additionalProperties: true` unless the endpoint genuinely accepts
  arbitrary key-value maps (document why if used).
- Enums: define as `enum` array on a `string` type; add a `description` naming the
  Python `StrEnum` class.
- Read schemas (response): include all computed / database-set fields (e.g. `id`,
  `created_at`).
- Write schemas (request body): omit server-set fields; mark all truly optional fields
  with `required: false` or exclude from the `required` array.

Mandatory global schemas (always include):

```yaml
  ProblemDetails:
    type: object
    description: RFC 7807 Problem Details for HTTP APIs
    required:
      - type
      - title
      - status
    properties:
      type:
        type: string
        format: uri
        example: "https://weave.internal/errors/validation-error"
      title:
        type: string
        example: "Validation Error"
      status:
        type: integer
        example: 422
      detail:
        type: string
        example: "Field 'label' must not be empty"
      instance:
        type: string
        format: uri
        example: "/ontology/triples/abc123"

  SparqlResultSet:
    type: object
    description: W3C SPARQL 1.1 Query Results JSON Format
    required:
      - head
      - results
    properties:
      head:
        type: object
        properties:
          vars:
            type: array
            items:
              type: string
      results:
        type: object
        properties:
          bindings:
            type: array
            items:
              type: object
              additionalProperties:
                type: object
                properties:
                  type:
                    type: string
                    enum: [uri, literal, bnode]
                  value:
                    type: string
```

##### Phase E — Shared response components

Write the `components/responses` block for reusable error responses.

```yaml
components:
  responses:
    BadRequest:
      description: Invalid request payload or parameters
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
    Unauthorized:
      description: Missing or invalid bearer token
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
    Forbidden:
      description: Token valid but insufficient permissions
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
    NotFound:
      description: Resource not found
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
    UnprocessableEntity:
      description: FastAPI/Pydantic validation error (HTTP 422)
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
    InternalServerError:
      description: Unexpected server-side error
      content:
        application/problem+json:
          schema:
            $ref: '#/components/schemas/ProblemDetails'
```

Rules:
- All error responses use `application/problem+json` content type (RFC 7807).
- Reference these via `$ref: '#/components/responses/<Name>'` in every endpoint.
- Do NOT inline error schemas — always use `$ref`.

#### After all sections approved

##### Coverage check

Count: total endpoints defined ÷ total endpoints listed in the Step 2 resource table.
Write `coverage: <pct>%` into the metadata comment header.

Update `_AUTO: false` if manually authored (which it always is for new specs).

##### Validate YAML structure

Run a structural check:
```bash
python3 -c "import yaml, sys; yaml.safe_load(open('docs/specs/weave/engines/<entity>/tech-spec/openapi.yaml'))" \
  && echo "YAML valid" || echo "YAML INVALID — fix before commit"
```

If invalid: identify the error, fix it, re-present only the corrected section to the user.

##### Architecture diagram

Produce a Mermaid flowchart in chat (not in the YAML file) showing the API surface:

```mermaid
flowchart LR
    Client -->|JWT| API["FastAPI<br/><entity>"]
    API --> DB[("Aurora PostgreSQL")]
    API --> RDF[("Oxigraph / Neptune")]
    API --> Cache[("ElastiCache Redis")]

    subgraph Endpoints
        direction TB
        E1["POST /resource"]
        E2["GET /resource/{id}"]
        E3["POST /sparql"]
    end

    API --> Endpoints
```

Adapt the diagram to the actual resources in this spec. Present to the user with:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <specific node or edge>
Why: <1 sentence — what was assumed>
</section-confidence>
```

Then ask via AskUserQuestion: Approve diagram / Amend / Skip (diagram not needed)

##### Commit

```bash
git add docs/specs/weave/engines/<entity>/tech-spec/openapi.yaml
git commit -m "docs(<entity>): add OpenAPI 3.1 spec — <N> endpoints across <M> resource groups"
```

##### Update progress state

```bash
.claude/scripts/progress.sh update openapi-<entity> done
```

If no matching task exists yet in `.claude/state/progress.json`, add it first:

```bash
.claude/scripts/progress.sh add-task openapi-<entity> arch-<entity> "OpenAPI 3.1 spec — <entity>"
.claude/scripts/progress.sh update openapi-<entity> done
```

Then tell the user: "OpenAPI spec complete. Continuing to Part 2 (data model) of this skill.
Once both are done: `/architect` for task breakdown, or `/qa` to validate against the PRD
acceptance criteria."

### Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
OpenAPI Law 1 (every endpoint has operationId): complied | violated | N/A — <reason>
OpenAPI Law 2 (all errors use RFC 7807 ProblemDetails): complied | violated | N/A — <reason>
OpenAPI Law 3 (schemas Pydantic v2 compatible — snake_case, no additionalProperties:true without justification): complied | violated | N/A — <reason>
OpenAPI Law 4 (HITL after every 3–5 endpoints — never full dump): complied | violated | N/A — <reason>
OpenAPI Law 5 (SPARQL endpoint present for ontology/graph APIs): complied | violated | N/A — <reason>
OpenAPI Law 6 (security schemes cover both Cognito and Auth0): complied | violated | N/A — <reason>
OpenAPI Law 7 (each endpoint batch has EARS acceptance criteria in chat): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat. Keeps Laws active across long sessions.

### Confidence block (emit before every HITL question)

Output this block immediately after presenting the section, before the AskUserQuestion:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific endpoint, field, or schema>
Why: <1 sentence — what input was missing or what you assumed>
</section-confidence>
```

Rules:
- Always name the weakest part, even on high-confidence sections.
- "Why" must reference a specific input gap (e.g. "assumed GET /triples uses cursor
  pagination because the PRD did not specify offset vs cursor").
- The block lives in chat only — do not embed it in the YAML file.

### Output

File: `docs/specs/weave/engines/<entity>/tech-spec/openapi.yaml`
Template: `.claude/spec-templates/architecture/openapi.yaml`

Create the directory if it doesn't exist:
```bash
mkdir -p "docs/specs/weave/engines/<entity>/tech-spec"
```

Never leave `{{PLACEHOLDER}}` in the output. All metadata fields in the comment header
must be populated before the final commit.

YAML file metadata header (comment block at top of file):

```yaml
# ---
# source: sme-authored-stub
# confirmed_by: "<author name>"
# confirmed_on: <YYYY-MM-DD>
# last_verified_sha: <git rev-parse HEAD>
# expires_on: <confirmed_on + 90 days>
# owner: <entity team>
# coverage: <pct>%
# _AUTO: false
# ---
```

### Evaluation Criteria

A well-produced `openapi.yaml`:

- Has a complete, valid `info` block (version, FastAPI/Pydantic v2 description,
  `x-weave-entity` extension) and passes `yaml.safe_load` without error before commit
- Has both `CognitoJWT` and `Auth0JWT` security schemes; top-level security defaults to
  `CognitoJWT`; public endpoints declare `security: []` explicitly
- Every endpoint has `operationId`, `summary`, `tags`, and all applicable response codes
  (200/201, 400, 401, 404, 422, 500)
- All error responses use `application/problem+json` content type with `$ref` to
  `ProblemDetails` (RFC 7807) — no inline error schemas anywhere
- All schemas are Pydantic v2 compatible: snake_case field names, no unexplained
  `additionalProperties: true`, explicit `format` on UUID and datetime fields
- Ontology/graph APIs include `POST /sparql` with `application/sparql-query` body and
  `SparqlResultSet` response schema
- Every endpoint batch has EARS acceptance criteria in chat (behaviour + status code +
  latency budget); EARS statements are inputs to downstream `/arch-task-brief` and `/qa`
- Was delivered in HITL batches of 3–5 endpoints (never full dump); constitutional
  self-check trace and confidence block present in chat for every section

---

## Part 2: Data Model

### Model

- **All phases:** claude-sonnet-5 (precise structured output, code generation, schema drafting)

Rationale: data-model work is a generation and precision task, not open-ended reasoning.
Sonnet is the right tier. Escalate to claude-fable-5 only when the entity boundary is
genuinely ambiguous and needs strategic framing.

### Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave product context, confirmed stack, laws
2. `.claude/spec-templates/architecture/data-model.md` — output scaffold
3. `docs/standards/patterns/data/sqlalchemy-async.md` — SQLAlchemy async style reference
4. `docs/specs/weave/engines/<entity>.md` — domain entities, bounded context, acceptance criteria
5. `docs/specs/weave/engines/<entity>/tech-spec/architecture.md` — if present, for layer overview
6. Any existing data model draft at `docs/specs/weave/engines/<entity>/tech-spec/data-model.md`

Ask the user which entity this is for if not supplied. Confirm the output path before writing:

```
docs/specs/weave/engines/<entity>/tech-spec/data-model.md
```

### Instructions

#### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs a data model before writing anything
else.

Example: "A data model spec's job is to make the persistence contract explicit before any
code is written. If an engineer reads it and still has to guess what a field means, its
nullability, or which layer owns it, the spec has failed. Every section should eliminate
ambiguity — not add commentary."

Reference this principle when justifying decisions during the HITL loop.

#### Step 1 — Context ingestion

1. Read all inputs listed above.
2. Identify which Weave sub-system this entity belongs to (Constitution Engine, Build Engine,
   Events & Actions, Graph Explorer, or cross-cutting).
3. Confirm the TWO data layers are relevant:
   - **Relational layer** (Aurora PostgreSQL via SQLAlchemy async) — operational data,
     multi-tenant rows, audit columns, migration-managed schema.
   - **Semantic web layer** (OWL 2 DL in Turtle, Oxigraph dev → Neptune prod) — the
     ontology graph; entities, properties, class hierarchies, and SHACL validation shapes.
   - Note: if the entity has NO semantic web presence, skip RDF/OWL and SHACL sections and
     state why. Do not silently omit them.
4. Summarise in 3 bullets before asking the first question:
   - Which entities will appear in the relational layer
   - Which classes/properties will appear in the RDF layer
   - What is still ambiguous (cardinalities, polymorphism, cross-entity references)

Ask via AskUserQuestion: "Which data layer(s) are in scope for this entity?"
Options: Both layers / Relational only / RDF/OWL only / I need help deciding

#### Step 2 — Entity discovery

Before drafting the ER diagram, confirm the entity list with the user.

Present a draft entity list as a table:

| Proposed entity | Layer | Rationale |
|---|---|---|
| `<entity>` | relational / RDF / both | `<why>` |

Ask via AskUserQuestion: "Does this entity list look correct?"
Options: Approve and continue / Add missing entities / Remove entities / Amend

Only proceed once the entity list is approved.

#### Step 3 — Section-by-section production

Produce each section in the order below. For every section:

1. **Write** the section to the output file (create directory if needed)
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated
3. **Present** the written section in chat
4. **Emit a confidence block** (see below) immediately before the HITL question
5. **Ask** via AskUserQuestion: Approve / Amend / Reject
6. If Amend: apply changes, show a minimal diff, re-present with updated confidence block
7. If Reject: regenerate with a cleaner approach, present the new version

##### Section 1 — Entity overview (Mermaid ER diagram — MANDATORY)

Produce a Mermaid `erDiagram` for the **relational layer**.

Rules:
- Include ALL tables confirmed in Step 2 (relational layer only)
- Show PKs, FKs, and cardinality (`||--o{`, `||--||`, `}o--o{`)
- Include the most important non-FK fields (3-5 per entity max — omit noise)
- Add a brief prose paragraph below the diagram (3-5 sentences) explaining the core
  relationships

If the entity has a semantic web layer, add a second Mermaid `classDiagram` showing the
OWL class hierarchy and key object/data properties. Label edges with property names.

Example relational ER skeleton (always expand for actual entities):

```mermaid
erDiagram
    TENANT ||--o{ WORKSPACE : "owns"
    WORKSPACE ||--o{ ONTOLOGY_GRAPH : "contains"
    ONTOLOGY_GRAPH {
        uuid id PK
        uuid workspace_id FK
        string slug
        string label
        timestamp created_at
    }
```

Example OWL class diagram skeleton:

```mermaid
classDiagram
    class owl_Thing
    class WeaveEntity {
        +weave:id xsd:string
        +weave:label xsd:string
    }
    owl_Thing <|-- WeaveEntity
```

##### Section 2 — Entity definitions (relational layer) — batched 3-5 per HITL

For each relational entity, produce a definition block:

**`<table_name>`**

Purpose: one sentence.

SQLAlchemy model (Python 3.12, SQLAlchemy 2.0 async style — follow the few-shot at
`docs/standards/patterns/data/sqlalchemy-async.md`):

```python
# app/models/<module>/<table_name>.py
```

Field table:

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `UUID` | PK, default uuid4 | surrogate key |
| `tenant_id` | `UUID` | FK → `tenants.id`, NOT NULL | row-level tenancy |
| ... | ... | ... | ... |

Indexes: list non-PK indexes with rationale.

Repository sketch (if the entity has non-trivial query patterns):

```python
# app/repositories/<module>/<table_name>_repository.py
```

Deliver entities in batches of 3-5. After each batch, ask via AskUserQuestion:
"Approve this batch / Amend / Add more entities to this batch"

##### Section 3 — RDF/OWL ontology model

Produce Turtle serialisation for the OWL 2 DL ontology fragment.

Rules:
- Namespace prefixes at top: `@prefix weave: <https://weave.io/ontology#> .` and any W3C
  prefixes used (owl, rdf, rdfs, xsd, skos, prov)
- Declare each class with `a owl:Class`, add `rdfs:label`, `rdfs:comment`, `rdfs:subClassOf`
  where applicable
- Declare object properties (`owl:ObjectProperty`) and data properties (`owl:DatatypeProperty`)
- Add domain/range restrictions where the ontology is definite
- Use `owl:FunctionalProperty` for single-valued properties
- Reference ArchiMate 3 notation in comments where the entity maps to an ArchiMate element

Example fragment (always replace with actual ontology):

```turtle
@prefix owl:   <http://www.w3.org/2002/07/owl#> .
@prefix rdf:   <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs:  <http://www.w3.org/2000/01/rdf-schema#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .
@prefix weave: <https://weave.io/ontology#> .
@prefix skos:  <http://www.w3.org/2004/02/skos/core#> .
@prefix prov:  <http://www.w3.org/ns/prov#> .

weave:OntologyGraph a owl:Class ;
    rdfs:label "Ontology Graph"@en ;
    rdfs:comment "A versioned RDF named graph containing a tenant's business ontology."@en ;
    rdfs:subClassOf prov:Entity .

weave:hasWorkspace a owl:ObjectProperty, owl:FunctionalProperty ;
    rdfs:domain weave:OntologyGraph ;
    rdfs:range  weave:Workspace ;
    rdfs:label  "has workspace"@en .
```

After writing, present the Turtle, run the self-check, emit confidence block, ask HITL.

Skip this section if the entity is relational-only (state why explicitly).

##### Section 4 — SHACL shapes

Produce SHACL shapes in Turtle for the key validation constraints on the RDF graph.

Rules:
- One `sh:NodeShape` per OWL class defined in Section 3
- Include: `sh:targetClass`, `sh:property` blocks for mandatory properties, datatype
  constraints (`sh:datatype`), cardinality (`sh:minCount`, `sh:maxCount`), and pattern
  constraints (`sh:pattern`) where relevant
- Use `sh:message` on every constraint
- Namespace: `@prefix sh: <http://www.w3.org/ns/shacl#> .`

Example skeleton (always replace with actual shapes):

```turtle
@prefix sh:    <http://www.w3.org/ns/shacl#> .
@prefix weave: <https://weave.io/ontology#> .
@prefix xsd:   <http://www.w3.org/2001/XMLSchema#> .

weave:OntologyGraphShape a sh:NodeShape ;
    sh:targetClass weave:OntologyGraph ;
    sh:property [
        sh:path      weave:hasWorkspace ;
        sh:minCount  1 ;
        sh:maxCount  1 ;
        sh:message   "An OntologyGraph must belong to exactly one Workspace." ;
    ] ;
    sh:property [
        sh:path      weave:graphLabel ;
        sh:datatype  xsd:string ;
        sh:minCount  1 ;
        sh:pattern   "^[a-zA-Z0-9_\\-]{1,128}$" ;
        sh:message   "graphLabel must be 1-128 alphanumeric characters, dashes, or underscores." ;
    ] .
```

After writing, present the shapes, run the self-check, emit confidence block, ask HITL.

Skip this section if the entity is relational-only (state why explicitly). Also skip if
Section 3 was skipped.

##### Section 5 — Migration and versioning notes

Cover:

1. **Alembic migration strategy** (relational layer):
   - Migration file naming convention: `YYYYMMDD_NNN_<slug>.py`
   - Zero-downtime rules: additive-only in a single deploy; breaking changes in two-phase
     (expand/contract pattern)
   - Multi-tenancy: confirm whether migrations run per-schema or once on shared tables
   - Rollback posture: specify which migrations are reversible (downgrade function present)
   - Seed data: if the migration includes seed/reference data, document it here

2. **Ontology versioning** (RDF/OWL layer, if applicable):
   - Version IRI convention: `<https://weave.io/ontology/<entity>/v{MAJOR}>`
   - Backward-compatible change rules (additive: new classes/properties; non-breaking
     relaxations of cardinality)
   - Breaking-change protocol: bump MAJOR, deprecate old IRI with `owl:deprecated true`,
     keep deprecated IRI resolvable for one release cycle
   - Named-graph versioning in Oxigraph/Neptune: each version stored as a separate named
     graph with PROV-O provenance triples

3. **Cross-layer referencing**:
   - Document how relational row IDs are linked to RDF subject IRIs
   - Convention: `<https://weave.io/resource/<table>/<uuid>>` as the IRI for a relational
     row exposed to the graph layer
   - State which layer is the source-of-truth for each entity

After writing, run the self-check, emit confidence block, ask HITL.

#### Step 4 — After all sections approved

Update the file frontmatter to set `status: Review` and `confirmed_by: <user>`.

Commit the artifact:

```bash
git add docs/specs/weave/engines/<entity>/tech-spec/data-model.md
git commit -m "docs(<entity>): add data-model tech spec"
```

Then tell the user: "Data model complete — openapi.yaml and data-model.md are both done.
Next: `/arch-diagrams` for C4/class/flow diagrams (if not already done), or `/architect` to
continue the full tech spec."

### Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
Data Law 1 (both layers explicit): complied | violated | N/A — <reason>
Data Law 2 (Mermaid ER mandatory for relational): complied | violated | N/A — <reason>
Data Law 3 (Turtle for OWL layer): complied | violated | N/A — <reason>
Data Law 4 (SHACL shapes present if OWL present): complied | violated | N/A — <reason>
Data Law 5 (SQLAlchemy async style match few-shot): complied | violated | N/A — <reason>
Data Law 6 (migration expand/contract stated): complied | violated | N/A — <reason>
Data Law 7 (cross-layer IRI convention stated): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

**Skill-specific laws:**

- **Data Law 1** — Both relational and RDF/OWL layers must be explicitly addressed or
  explicitly skipped with a stated reason.
- **Data Law 2** — A Mermaid `erDiagram` is mandatory whenever the relational layer is
  in scope. The spec is incomplete without it.
- **Data Law 3** — RDF entities must be represented in Turtle serialisation, not prose
  descriptions of triples.
- **Data Law 4** — Every OWL class defined in Section 3 must have a corresponding SHACL
  `NodeShape` in Section 4.
- **Data Law 5** — All SQLAlchemy models must follow the async style shown in the few-shot
  reference: `Mapped[T]`, `mapped_column(...)`, `async def` on repositories.
- **Data Law 6** — The migration section must explicitly state the expand/contract posture
  and name which migrations include a downgrade function.
- **Data Law 7** — The IRI convention for cross-layer referencing (`/resource/<table>/<uuid>`)
  must be stated in the migration section.

### Confidence block (emit before every HITL question)

Output this block immediately after presenting the section, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific entity, field, property, or shape>
Why: <1 sentence — what input was missing or what you assumed>
</section-confidence>
```

Rules:
- Always name the weakest part, even on high-confidence sections.
- "Why" must reference a specific input gap (e.g. "cardinality of Workspace-to-Tenant not
  stated in PRD", "field nullability for `deleted_at` assumed false").
- The block lives in chat only — do not embed it in the output file.

### Output

File: `docs/specs/weave/engines/<entity>/tech-spec/data-model.md`

Template: `.claude/spec-templates/architecture/data-model.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.

Frontmatter:

```yaml
---
type: Data Model Spec
title: "Data Model: <entity display name>"
description: "<one-line summary of the relational + semantic data model for this entity>"
tags: [<entity>, arch]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: Draft
created: <YYYY-MM-DD>
entity: <entity>
layers:
  - relational        # remove if not applicable
  - rdf-owl           # remove if not applicable
confirmed_by: ""
confirmed_on: null
---
```

The file structure must follow this order:

1. Frontmatter
2. `# Data Model: <entity display name>`
3. Brief prose overview (3-5 sentences: what this model represents, which layers, key design
   decisions)
4. `## Entity overview` — Mermaid ER (relational) and/or class diagram (OWL)
5. `## Entity definitions` — per-entity SQLAlchemy model + field table + index notes
6. `## RDF/OWL ontology model` — Turtle serialisation (or "Not applicable — <reason>")
7. `## SHACL shapes` — Turtle shapes (or "Not applicable — <reason>")
8. `## Migration and versioning notes` — Alembic, ontology versioning, cross-layer IRIs

### Evaluation Criteria

A well-produced data-model spec:

- Contains a Mermaid `erDiagram` for every entity in the relational layer — no exceptions
- All SQLAlchemy models use `Mapped[T]` / `mapped_column(...)` async style (Law 5)
- RDF layer is represented in Turtle with proper namespace prefixes; no prose-only
  descriptions of triples
- Every OWL class in Section 3 has a corresponding `sh:NodeShape` in Section 4
- Migration section names the expand/contract posture and identifies reversible migrations
- Cross-layer IRI convention (`/resource/<table>/<uuid>`) stated explicitly
- No `{{PLACEHOLDER}}` text remains in the output file
- Delivered section-by-section with HITL at every section; constitutional self-check trace
  present in chat for every section
