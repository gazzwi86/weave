---
name: okf-validate
description: >-
  Validate the docs/ OKF bundle (wiki + specs + standards) for conformance with
  OKF v0.1 specification. Reports hard errors (missing frontmatter, missing `type`)
  and soft warnings (missing recommended fields, broken cross-links). Use after
  /anatomy or spec edits to confirm the bundle is well-formed, or before pushing
  to catch regressions.
user-invocable: true
argument-hint: "[--strict] [--json]"
allowed-tools: Bash
---

# /okf-validate — OKF bundle conformance checker

Validates the unified `docs/` bundle (wiki + specs + standards) as an OKF v0.1
bundle using the deterministic checker at `.claude/scripts/okf_validate.py`.

> **Note:** `/anatomy` still validates `docs/wiki/` specifically as its own
> sub-bundle. Default unified validation targets `docs/`.

## Arguments

`$ARGUMENTS` — forwarded verbatim to the checker.

- **`--strict`** — treat warnings as errors (useful in CI)
- **`--json`** — emit a machine-readable JSON report

## Procedure

Run (unified bundle):

```bash
uv run .claude/scripts/okf_validate.py docs $ARGUMENTS
```

Or validate just the wiki sub-bundle (as `/anatomy` does):

```bash
uv run .claude/scripts/okf_validate.py docs/wiki $ARGUMENTS
```

## Conformance rules (OKF v0.1 §9)

**Hard errors** (bundle is non-conformant if any fire):
1. Every non-reserved `.md` file must have a parseable YAML frontmatter block.
2. Every frontmatter block must contain a non-empty `type` field.

**Warnings** (soft guidance — become errors with `--strict`):
- Recommended fields absent: `title`, `description`, `tags`, `timestamp`
- Broken bundle-internal cross-links (§5.3 requires consumers to tolerate these,
  but they signal stale links worth fixing)
- Reserved files (`index.md`, `log.md`) malformed per §6 / §7

## Output

Report each `ERROR` and `warn` line, then the conformance verdict. A zero exit
code means the bundle passed (conformant, or conformant-with-warnings without
`--strict`). A non-zero exit means non-conformant.
