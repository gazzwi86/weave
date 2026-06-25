---
source: graph.json@{{GRAPH_SHA}}
confirmed_by: "none"
confirmed_on: null
last_verified_sha: {{HEAD_SHA}}
expires_on: {{EXPIRES_ON}}
owner: {{OWNER}}
coverage: {{COVERAGE_PCT}}
---
<!-- Domain-scoped CLAUDE.md. Auto-loaded by Claude Code when reading files in this subtree. -->
<!-- Line budget: 100 lines. Overflow lives in docs/architecture/, linked below. Do not hand-edit generated sections — your edits go in "Human notes". -->
<!-- Frontmatter schema: templates/frontmatter-schema.md -->

# {{DOMAIN_NAME}}

{{DOMAIN_PURPOSE_ONE_LINE}}

> Coverage: {{COVERAGE_PCT}}% of LOC in this domain analysed{{COVERAGE_EXCLUSIONS}}

## Read before touching `{{DOMAIN_PATH}}/**`

- [`docs/architecture/architecture.md#{{domain-slug}}`](../../docs/architecture/architecture.md#{{domain-slug}}) — component view
- [`docs/architecture/flows.md#{{flow-slug}}`](../../docs/architecture/flows.md#{{flow-slug}}) — primary flow
- [`docs/architecture/data-model.md#{{entity-slug}}`](../../docs/architecture/data-model.md#{{entity-slug}}) — entities this domain owns
- [`docs/architecture/invariants.md`](../../docs/architecture/invariants.md) — business invariants (always check)
- [`.claude/state/context/tribal-knowledge.md#{{domain-slug}}`](../../.claude/state/context/tribal-knowledge.md#{{domain-slug}}) — gotchas

## Entry points (top 3 by graph centrality)

| Entry | File#symbol | Notes |
|---|---|---|
| {{entry_1}} | `{{path_1}}#{{symbol_1}}` | {{notes_1}} |
| {{entry_2}} | `{{path_2}}#{{symbol_2}}` | {{notes_2}} |
| {{entry_3}} | `{{path_3}}#{{symbol_3}}` | {{notes_3}} |

## Applicable rules

Files matching this domain's path are covered by:

{{#each matching_rules}}
- [`{{rule_path}}`](../../{{rule_path}}) — {{rule_one_liner}}
{{/each}}

## Gotchas

<!-- Short, high-signal. Long-form belongs in .claude/state/context/tribal-knowledge.md. -->

- {{gotcha_1}}

## Invisible edges

These cross this domain boundary but the static graph does not see them. Always check before reasoning about coupling:

- {{edge_1}}

## Human notes

<!-- REGEN DISCIPLINE: content below this line is preserved verbatim by `sync`. Do not put it above this line. -->

*(empty)*
