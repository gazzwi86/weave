# Provenance Frontmatter Schema

Every generated artefact in a Weave project that is consumed by agents — architecture shards, context docs, rules, promoted skills — carries a YAML frontmatter block documenting where it came from, who signed it off, when to distrust it, and who to ask. The block is surfaced at session start (freshness banner) and in CI (orphan/expired issue-filing); see Enforcement below for validation status.

## Canonical shape

```yaml
---
source: anatomy@<short-sha> | hybrid | seed | hand-authored
confirmed_by: <github-handle | "none">
confirmed_on: <YYYY-MM-DD | null>
last_verified_sha: <commit sha of the source tree at last verification>
expires_on: <YYYY-MM-DD>
owner: <github-handle | "orphan">
coverage: <percent | "n/a">
---
```

## Field semantics

| Field | Required | Meaning |
|---|---|---|
| `source` | yes | How this artefact was produced. `anatomy@<sha>` for content sourced from the `/anatomy` command's OKF bundle generation. `hybrid` when anatomy-derived content is blended with hand-authored edits. `seed` for initial templates shipped by the plugin. `hand-authored` for human-written docs that opt into the schema. |
| `confirmed_by` | yes | GitHub handle of the human who last reviewed the content. `"none"` means unconfirmed — the agent surfaces a DRAFT banner when rendering. |
| `confirmed_on` | yes when `confirmed_by` is set | Date of confirmation. `null` when `confirmed_by: "none"`. |
| `last_verified_sha` | yes | The HEAD sha of the *source* repo at the moment this shard was last reconciled against code. Session-start banner compares this to current HEAD; >N commits triggers an advisory banner. |
| `expires_on` | yes | Date after which the content is considered stale regardless of `last_verified_sha`. Default TTL: 180 days for shards, 90 days for rules, 365 days for ADRs. |
| `owner` | yes | Who to ping when this goes stale. `"orphan"` triggers a weekly CI job to file a reassignment issue. |
| `coverage` | yes | For code-derived artefacts: the percentage of in-scope LOC the analysis covered (see `.claude/state/discovery/coverage.yml`). `"n/a"` for SME-derived or hand-authored content. |

## Rule-specific extension

Files under `.claude/rules/` additionally carry `scope:` — a glob that determines which paths the rule applies to:

```yaml
---
source: hand-authored
confirmed_by: alice
confirmed_on: 2026-04-20
last_verified_sha: abc1234
expires_on: 2026-07-20
owner: alice
coverage: n/a
scope: "src/db/migrations/**"
---
```

Multiple globs are permitted as a YAML sequence.

## Skill-specific extension

`.claude/skills/<topic>/SKILL.md` frontmatter already carries `name:` and `description:` (required by Claude Code's auto-matching). Weave-generated skills add the provenance block alongside those fields — the two coexist.

## Spec-artifact extension

Spec artefacts under `docs/specs/**` (briefs, PRDs, roadmaps, the inter-engine contracts reference) carry a **merged** frontmatter: the descriptive fields (`type`, `title`, `description`, `tags`, `status`, `timestamp`, `resource`) **and** the provenance block (`source`, `confirmed_by`, `confirmed_on`, `last_verified_sha`, `expires_on`, `owner`, `coverage`). The two coexist — descriptive fields drive discovery/rendering; the provenance block drives drift detection, expiry, and ownership. The PRD template (`.claude/spec-templates/prd.md`) shows the canonical merged shape; default `expires_on` for PRDs/briefs is today + 180 days.

## Enforcement

- **Shape validation**: no automated validator currently enforces this schema (the `reconcile` skill that did this is retired). Authors are responsible for valid YAML, all required fields, and an allowed `source` literal until a replacement lands.
- **Session-start banner** (`scripts/session-start.sh`) surfaces files where `last_verified_sha` is >50 commits behind HEAD or `expires_on` is in the past.
- **Weekly CI** files issues for `owner: orphan` files and files with `expires_on < today`.

## Authoring discipline

- Generators set `confirmed_by: "none"` on first write; human promotion flips it. Never fabricate a confirmer.
- `last_verified_sha` is set by the generator to HEAD at generation time. Update it by hand after a human has read the file against current code (the `reconcile --reverify` flow that used to automate this is retired).
- `expires_on` is computed at write time as today + TTL. Overrides are welcome (e.g., a stable invariant might set +730 days).
- Do not hand-edit `source: anatomy@<sha>` unless you are intentionally converting the file to `hand-authored` — doing so removes it from drift detection.
