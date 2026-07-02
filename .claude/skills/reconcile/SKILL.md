---
name: reconcile
description: Compares code reality from Graphify against existing documentation and checks discovery artefact health, in two modes (code-vs-docs conflict detection and wiki-lint hygiene). Invoked from init's brownfield path after discover or from a phase-gate check.
---

# Reconcile

Compare code reality (from Graphify) against existing documentation and check discovery artefact health. Two modes: Code-vs-Docs conflict detection, and Wiki-lint for artefact hygiene.

## Trigger

- Invoked from the `init` skill's brownfield path (after `discover`), mode A by default
- Invoked from a phase-gate check (mode B: wiki-lint) to surface artefact drift
- No standalone slash command; callers pass the mode explicitly

## Arguments

Callers pass a mode: `code-vs-docs` (Mode A) or `wiki-lint` (Mode B). If no mode is provided, offer the user an MCQ via AskUserQuestion.

## Laws

1. **Never auto-resolve contradictions** — flag for human decision.
2. **Never modify source code.**
3. **Always cite sources** — file path + line number or graph node ID.

## Instructions

### Step 1: Determine Mode

If no arguments provided, ask via AskUserQuestion:
- **Code-vs-Docs** — Compare what Graphify found in the code against what existing documentation says. Surfaces contradictions for human resolution.
- **Wiki-lint** — Health check of the discovery artefacts themselves (orphans, staleness, drift).

### Mode A: Code-vs-Docs

#### A1: Load the Graph

Read `.claude/state/discovery/graph.json` (the Graphify output). If the file does not exist, stop and tell the user to run `/init` on the brownfield project first (this invokes the `discover` skill to produce the graph).

#### A2: Gather Existing Documentation

Read all existing docs:
- `README.md`
- All files under `docs/` (specs, architecture, API docs, etc.)
- Wiki exports if present in the repo
- Confluence pages if available via MCP

If no documentation exists beyond the graph, report: "No existing documentation found to reconcile against. Mode A has nothing to compare — consider running Mode B (wiki-lint) instead." and stop.

#### A3: Claim Extraction

For each document found, extract discrete claims about the system:
- Architectural claims (e.g. "uses PostgreSQL", "follows hexagonal architecture")
- Dependency claims (e.g. "depends on Redis for caching")
- Behaviour claims (e.g. "rate limits to 100 req/s")
- Coverage claims (e.g. "90% test coverage on core module")
- Integration claims (e.g. "calls Stripe API for payments")

#### A4: Cross-Reference Against Graph

For each extracted claim, check if `graph.json` supports or contradicts it:
- **Confirmed** — graph evidence directly supports the claim
- **Contradicted** — graph evidence directly conflicts with the claim
- **Unverifiable** — graph has no evidence either way

#### A5: Produce Conflict List

Output a table:

| # | Source Doc | Claim | Graph Evidence | Verdict |
|---|-----------|-------|----------------|---------|
| 1 | README.md:L42 | "Uses Redis for session storage" | graph node `cache-layer` shows Memcached | Contradicted |
| 2 | docs/api.md:L18 | "REST API with 12 endpoints" | graph cluster `api-routes` has 15 nodes | Contradicted |
| 3 | docs/specs/weave/engines/<entity>/tech-spec/stack.md:L5 | "PostgreSQL 14" | graph node `db` shows PostgreSQL | Confirmed |

#### A6: Source-of-Truth Recommendation

For each contradiction, suggest which source is likely SOT using this matrix:

| Domain | Source of Truth |
|--------|----------------|
| Implementation details, actual dependencies, test coverage | Code (graph) |
| Business requirements, domain rules, compliance | Docs |
| Tribal knowledge, context, "why we did it this way" | Interviews |

Present the recommendation but never auto-resolve. Each contradiction must be flagged for human decision.

#### A7: Escalate Unresolvable Items

For items needing human input, suggest running `/elicit` with the appropriate method:
- Conflicting requirements -> Six Thinking Hats
- Unclear root cause -> Five Whys
- Multiple valid interpretations -> Stochastic Reasoning

### Mode B: Wiki-lint

#### B1: Scan Artefacts

Read all files in:
- `docs/discovery/brownfield/` (shards)
- `.claude/state/discovery/` (graph.json)
- `docs/discovery/` (index, GRAPH_REPORT.md)
- `docs/discovery/brownfield-architecture.md` (reality-doc)
- `.claude/state/context/` (interview outputs)

#### B2: Run Health Checks

Perform all of the following checks:

**Orphan shards:**
- For each shard file in `docs/discovery/brownfield/`, verify it is referenced from `docs/discovery/brownfield-architecture.md`
- Flag any shard file that exists but is not referenced

**Stale claims:**
- Check file modification dates on all shard files
- Flag any shard updated more than 90 days ago without a refresh marker
- A refresh marker is a line containing `Last refreshed: YYYY-MM-DD`

**Missing cross-refs:**
- For each shard, check if it mentions component names
- Verify those component names have corresponding node IDs in `graph.json`
- Flag mentions without graph node references

**Graph drift:**
- Extract all cluster names from `graph.json`
- Check if each cluster is represented in at least one shard or in `brownfield-architecture.md`
- Flag clusters with no corresponding documentation

**Coverage gaps:**
- Identify major graph clusters (clusters with > 5 nodes)
- Check if each has a corresponding shard with substantive detail (not just a title)
- Flag clusters with no or minimal documentation

**Line budget violations:**
- Check each shard file line count
- Flag any shard exceeding 200 lines
- Suggest archiving older sections to keep shards focused

**B7 — Anchor validity:**
- Scan every markdown file under `.claude/`, `docs/architecture/`, `docs/discovery/brownfield/`, `.claude/state/context/` for intra-repo links of the form `path.md#heading-anchor`.
- For each, load the target file and extract all headings (`#`, `##`, `###`, ...). Slugify each heading (GitHub-style: lowercase, spaces→hyphens, strip punctuation).
- Flag every pointer whose `#anchor` does not appear in the slugified heading set. Do not accept `:line` pointers — flag them as anti-pattern and suggest conversion to heading anchors.
- Strict mode (`--strict-anchors` or CI pre-merge): exit non-zero on any broken anchor.

**B8 — Frontmatter shape:**
- For every file under `.claude/rules/`, `.claude/skills/*/SKILL.md`, `docs/architecture/**`, `.claude/state/context/*.md`, parse the opening YAML frontmatter block.
- Validate shape per `${CLAUDE_PLUGIN_ROOT}/templates/frontmatter-schema.md`:
  - Required keys: `source`, `confirmed_by`, `confirmed_on`, `last_verified_sha`, `expires_on`, `owner`, `coverage`.
  - `source` must be one of: `graph.json@<sha>`, `sme-interview`, `hybrid`, `seed`, `hand-authored`.
  - `confirmed_on` must be `null` when `confirmed_by: "none"`; otherwise `YYYY-MM-DD`.
  - `expires_on` must parse as `YYYY-MM-DD`.
  - Rule files additionally require `scope:` (glob string or list of strings).
- Flag missing, unparseable, or malformed frontmatter. Strict mode: exit non-zero.

**B9 — Line-cap enforcement:**
- Read caps from `.claude/settings.json` `weave.brownfield.claudeMd` (defaults: root CLAUDE.md 60, domain CLAUDE.md 100, rule 60, shard 200).
- Enforce:
  - Root `.claude/CLAUDE.md` ≤ rootLineCap
  - Any nested `**/CLAUDE.md` ≤ domainLineCap
  - `.claude/rules/*.md` ≤ ruleLineCap
  - `docs/architecture/**.md` and `docs/discovery/brownfield/*.md` ≤ shardLineCap
- Overrides: a line `<!-- weave: allow-long reason=... -->` in the first 10 lines bypasses the cap for that file; the reason is recorded in the report. Untracked overrides (no reason string) are flagged.
- Also flag non-canonical filenames in scoped directories (`CLAUDE-extra.md`, `CLAUDE-2.md`, `rules/NOTES.md`) — these are route-arounds; require rename or removal.

**B10 — Dedup:**
- Build two indexes:
  1. Rule index: every `**:` prefixed bullet or "MUST/NEVER" sentence in `.claude/rules/*.md`, keyed by normalised sentence.
  2. CLAUDE.md index: same extraction across every CLAUDE.md in the tree.
- Flag any rule sentence that also appears in a CLAUDE.md (or near-duplicate via Levenshtein ≤ 5% of length). CLAUDE.md must *link* to the rule, never restate it.
- Shard dedup: for every path under `docs/architecture/`, check if a file of the same basename exists under `docs/discovery/brownfield/` with non-stub content (>3 non-frontmatter lines). Flag as a dedup violation — during the migration window only stub-with-pointer is allowed in the brownfield/ location.

#### B3: Generate Report

Write findings to `.claude/state/reconcile-report.md`:

```markdown
# Reconcile Report

Generated: {{DATE}}
Mode: Wiki-lint

## Summary
- Orphan shards: {count}
- Stale claims: {count}
- Missing cross-refs: {count}
- Graph drift: {count}
- Coverage gaps: {count}
- Line budget violations: {count}

## Findings

### Orphan Shards
{table of orphan shards with file paths}

### Stale Claims
{table of stale shards with last modified date}

### Missing Cross-References
{table of mentions without graph node IDs}

### Graph Drift
{table of undocumented clusters}

### Coverage Gaps
{table of major clusters lacking detail}

### Line Budget Violations
{table of oversized shards with line counts}

## Suggested Actions
{prioritized list of remediation steps}
```

Also display the summary to the user in the conversation.
