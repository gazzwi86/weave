---
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: {{HEAD_SHA}}
expires_on: {{EXPIRES_ON}}
owner: {{OWNER}}
coverage: n/a
---
# Historical ADRs — current-state decisions

Each file in this directory records an architectural decision that shaped the system as it stands today. These are *historical* ADRs reverse-engineered from code + SME interviews, distinct from forward-looking ADRs in `docs/specs/decisions/`.

## Filename convention

`ADR-{NNN}-{slug}.md` — three-digit, monotonically increasing.

## Required sections

- **Status**: Accepted | Superseded-by: ADR-NNN
- **Context**: why this decision needed to be made, observed at the time
- **Decision**: what was decided
- **Consequences**: positive + negative, observed after the fact
- **Alternatives considered**: what else was on the table

## Authoring

- `discover` does NOT auto-generate historical ADRs. They are populated by `interview --role architect`, which emits candidates for human promotion.
- If you supersede an ADR, set `Status: Superseded-by: ADR-NNN` and file the replacement; never delete.
- `reconcile` B8 validates frontmatter shape on every ADR file.
