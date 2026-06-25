---
description: Refresh the project's current-state architecture tree, CLAUDE.md hierarchy, and drift report.
argument-hint: "[--check-drift|--reverify|--coverage]"
---

# /sync

Refresh the project's current-state architecture tree, CLAUDE.md hierarchy, and drift report. Composes dependency-check → discover → reconcile into a single verb.

**Backed by skills:** `${CLAUDE_PLUGIN_ROOT}/skills/discover/SKILL.md`, `${CLAUDE_PLUGIN_ROOT}/skills/reconcile/SKILL.md`

## When to use

- After material code changes that might have invalidated `docs/architecture/*` shards
- Before opening a PR that touches multiple domains
- After the session-start freshness banner flags stale shards
- As a periodic maintenance pass (monthly, or quarterly on stable repos)

## Arguments

```
/sync                 # Default: discover (regen shards + CLAUDE.md) then reconcile (wiki-lint)
/sync --check-drift   # Read-only: run reconcile --mode wiki-lint only; do not regenerate
/sync --reverify      # Bump last_verified_sha on shards the human has just read-and-approved; no content regen
/sync --coverage      # Rebuild .claude/state/discovery/coverage.yml only
```

## Instructions

When the user runs `/sync` (default), invoke in order:

1. `${CLAUDE_PLUGIN_ROOT}/skills/dependency-check/SKILL.md` — verify Graphify, tokei/cloc are present.
2. `${CLAUDE_PLUGIN_ROOT}/skills/discover/SKILL.md` — regenerate graph.json, coverage.yml, docs/architecture/*, brownfield shards, and the nested CLAUDE.md hierarchy. The scrubber hook gates every write under `docs/architecture/` and `.claude/state/context/`.
3. `${CLAUDE_PLUGIN_ROOT}/skills/reconcile/SKILL.md` (Mode B, wiki-lint) — validate frontmatter (B8), anchor links (B7), line caps (B9), dedup (B10), stale shards (B1–B3), graph drift (B4–B6).

For `--check-drift`: skip steps 1–2; run only step 3.
For `--reverify`: run a verification prompt that asks the user which shards have been human-reviewed, then update `last_verified_sha` frontmatter without regen.
For `--coverage`: run only the coverage subroutine inside discover (Step 8.5).

## Output

On success:

```
weave sync complete.
  Coverage:     .claude/state/discovery/coverage.yml (<pct>% full-tier)
  Architecture: docs/architecture/ (<N> shards updated, <M> preserved)
  CLAUDE.md:    root + <K> domain files
  Drift report: <clean | <N> findings — see .claude/state/discovery-log.md>

Next steps:
  <If drift present> Review .claude/state/discovery-log.md and either re-approve (/sync --reverify) or edit.
  <If rule candidates> Review .claude/state/context/rule-candidates.md and promote to .claude/rules/.
```

On reconcile failure: non-zero exit, listing specific check + file + remediation. Do NOT auto-fix — surface for human decision.
