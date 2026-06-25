---
source: sme-interview
confirmed_by: {{SME_HANDLE}}
confirmed_on: {{CONFIRMED_DATE}}
last_verified_sha: {{HEAD_SHA}}
expires_on: {{EXPIRES_ON}}
owner: {{OWNER}}
coverage: n/a
scope: "{{PATH_GLOB}}"
---
<!-- Rule file for .claude/rules/. Line budget: 60. Only unconditional constraints belong here. -->
<!-- Frontmatter schema: templates/frontmatter-schema.md -->

# {{RULE_NAME}}

**Rule**: {{one_sentence_imperative}}.

**Applies when**: file path matches `{{PATH_GLOB}}`.

**Why**: {{rationale — usually a past incident or a business/compliance invariant}}.

**How to comply**:

- {{action_1}}
- {{action_2}}

**Red flags (when to reconsider this rule)**:

- {{circumstance_1}}
- {{circumstance_2}}

**Related**:

- [{{related_doc}}]({{path}})
