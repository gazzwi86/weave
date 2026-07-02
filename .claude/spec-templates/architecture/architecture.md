---
source: graph.json@{{GRAPH_SHA}}
confirmed_by: "none"
confirmed_on: null
last_verified_sha: {{HEAD_SHA}}
expires_on: {{EXPIRES_ON}}
owner: {{OWNER}}
coverage: {{COVERAGE_PCT}}
---
<!-- Current-state architecture. Mirrors the shape of docs/specs/weave/engines/<entity>/tech-spec/architecture.md but documents WHAT IS, not what will be. -->
<!-- Frontmatter schema: templates/frontmatter-schema.md -->
# Architecture (current state): {{PROJECT_NAME}}

> Coverage: {{COVERAGE_PCT}}% of LOC analysed{{COVERAGE_EXCLUSIONS}}
> See `.claude/state/discovery/coverage.yml` for per-language breakdown and `docs/specs/weave/engines/<entity>/tech-spec/architecture.md` for the future-state design.

## C4 Model — observed

### Level 1: System Context

```mermaid
C4Context
    title System Context (observed from deployed artefacts)
    Person(user, "{{ACTOR}}", "{{actor_role}}")
    System(system, "{{PROJECT_NAME}}", "{{system_purpose}}")
    System_Ext(ext1, "{{EXTERNAL_SYSTEM}}", "{{ext_description}}")

    Rel(user, system, "{{interaction}}")
    Rel(system, ext1, "{{integration}}")
```

> Graph node: {{L1_NODE_ID}} · Confidence: high (derived from build artefacts, manifests, deploy config).

### Level 2: Container

```mermaid
C4Container
    title Container Diagram (derived from graph.json top-level clusters)
    Person(user, "{{ACTOR}}")

    Container_Boundary(system, "{{PROJECT_NAME}}") {
        Container(c1, "{{CONTAINER_1}}", "{{tech_1}}", "{{purpose_1}}")
        Container(c2, "{{CONTAINER_2}}", "{{tech_2}}", "{{purpose_2}}")
        ContainerDb(db, "{{STORE}}", "{{db_tech}}", "{{store_purpose}}")
    }

    Rel(user, c1, "{{rel_1}}")
    Rel(c1, c2, "{{rel_2}}")
    Rel(c2, db, "{{rel_3}}")
```

> Graph node: {{L2_NODE_IDS}} · Confidence: high (derived from clustered dependency edges).

### Level 3: Component — DRAFT (unverified grouping)

> **This section was auto-generated from Graphify clusters. Cluster shape ≠ architectural component. Do not trust without SME confirmation.** See `.claude/state/context/patterns.md` for grouping rationale once an SME has reviewed.
>
> Status: `DRAFT — unverified grouping`. Run `/interview architect` to confirm or correct.

```mermaid
%% Placeholder cluster map (not C4 L3 until SME-confirmed).
flowchart TD
    cluster_a["{{CLUSTER_A}}<br/>({{cluster_a_nodes}} nodes)"] --> cluster_b["{{CLUSTER_B}}<br/>({{cluster_b_nodes}} nodes)"]
    cluster_b --> cluster_c["{{CLUSTER_C}}<br/>({{cluster_c_nodes}} nodes)"]
```

### Level 4: Code — not auto-generated

> L4 (class-level) requires SME-confirmed L3 groupings. Populate `class.md` (see sibling file) only after Level 3 is confirmed.

## Cluster Map

| Cluster | Nodes | Representative path | Churn (last 90d) | Confirmation |
|---|---|---|---|---|
| {{CLUSTER_NAME}} | {{NODE_COUNT}} | `{{REPR_PATH}}` | {{CHURN}} | {{none|alice|etc}} |

## Blind spots

<!-- Populated when coverage < 100%. Lists paths graph extraction did not analyse. -->

{{#each blind_spots}}
- `{{path}}` — reason: {{reason}}
{{/each}}

## Integration boundaries (invisible to static graph)

These edges the graph cannot see by construction. SME input required; add to `.claude/state/context/tribal-knowledge.md` and cite here:

- {{Dynamic dispatch / reflection / DI container boundaries}}
- {{Event bus / message queue topics}}
- {{Feature flag branches}}
- {{Cross-service calls via runtime-resolved URLs}}

## Archive

<!-- Compacted content moves here. Prefix each entry with the date it was archived. -->
