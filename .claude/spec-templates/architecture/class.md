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
<!-- Class-level view. Only emitted for clusters in full-tier languages AND after architecture.md Level 3 is SME-confirmed. -->
# Class diagram (current state): {{PROJECT_NAME}}

> Coverage: {{COVERAGE_PCT}}% of LOC analysed{{COVERAGE_EXCLUSIONS}}
> **Pre-condition**: `architecture.md` Level 3 must be confirmed by an SME before this file is trustworthy. If Level 3 is still DRAFT, treat this file as DRAFT too.

## {{MODULE_NAME}}

```mermaid
classDiagram
    class {{CLASS_A}} {
        +{{field}}: {{type}}
        +{{method}}({{args}}): {{return}}
    }
    class {{CLASS_B}} {
        +{{field}}: {{type}}
    }
    {{CLASS_A}} --> {{CLASS_B}} : "{{relationship}}"
```

> Graph nodes: {{NODE_IDS}}

## Language-tier gate

If the repository contains significant code in `partial-syntactic` or `unsupported` tiers (see `.claude/state/discovery/coverage.yml`), only full-tier languages are represented in this diagram. Unrepresented languages are listed in `architecture.md#blind-spots`.

## Archive
