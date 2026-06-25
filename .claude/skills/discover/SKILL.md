---
name: discover
description: Orchestrates brownfield codebase understanding via Graphify static analysis, git-history signals, and reality-doc generation, producing an architectural snapshot without modifying source. Runs when /init detects a brownfield project.
---

# Discover

Orchestrate brownfield codebase understanding via Graphify-powered static analysis, git-history signals, and reality-doc generation. Produces a complete architectural snapshot of an existing codebase without modifying any source code.

## Trigger

- `/init` detects a brownfield project (existing code, no `docs/specs/`) and invokes this skill
- Invoked from the `init` skill's brownfield path; no standalone slash command

## Laws

1. **Read-only.** Never modify existing source code during discovery. Only create/write files under `docs/`.
2. **No fabrication.** Every claim must cite a file path, graph node ID, or git commit SHA. If evidence is absent, say so.
3. **Actual state only.** Reality-doc captures what IS, not what should be. Document debt, workarounds, and inconsistencies honestly.
4. **Shard line budget.** Each shard respects the ~200 line budget. Overflow goes to an archive section at the bottom of the shard.

## Core Principles

- Prefer Graphify's analysis over re-reading files. The graph IS the primary evidence.
- Cross-reference graph node IDs in shards so agents can drill into detail later.
- Mermaid diagrams should be readable standalone (on GitHub) without requiring `graph.html`.
- The discover skill does NOT do reconciliation or interviews — those are separate skills invoked afterwards by init.

## Instructions

### Step 1: Greenfield Guard

Check if the project directory has meaningful source code (e.g. `package.json`, `setup.py`, `Cargo.toml`, `go.mod`, `*.sln`, or a `src/` directory with files). If the directory is empty or contains only config stubs, halt:

```
This appears to be a greenfield project — no existing source code detected.
Discovery is for brownfield codebases. Use /po to start from scratch.
```

### Step 2: Dependency Check

Invoke `${CLAUDE_PLUGIN_ROOT}/skills/dependency-check/SKILL.md` (brownfield-specific checks). That skill owns the `graphify` presence check and the install instructions. If it halts, do not proceed.

### Step 3: Graph Extraction

Run Graphify's extractor from the project root:

```bash
graphify update .
```

Wait for completion. This produces `graphify-out/` containing:
- `graph.html` — interactive dependency graph
- `GRAPH_REPORT.md` — narrative analysis report
- `graph.json` — machine-readable graph data
- `cache/` — intermediate analysis cache

If `graphify` exits non-zero, report the error and halt. Do not proceed with partial data.

**Existence assertion.** After `graphify update` completes, verify that both `graphify-out/graph.html` and `graphify-out/graph.json` exist and are non-empty. If either is missing or empty, halt with a specific error naming the missing artefact — do not silently continue with partial data:

```bash
for f in graphify-out/graph.html graphify-out/graph.json; do
  [ -s "$f" ] || { echo "Graphify did not produce $f — halting discovery."; exit 1; }
done
```

`GRAPH_REPORT.md` is optional (narrative only); a warning is sufficient if it is missing.

### Step 4: Artefact Placement

Create directories and move Graphify outputs into the project's docs structure:

```bash
mkdir -p docs/discovery .claude/state/discovery
```

| Source | Destination |
|--------|-------------|
| `graphify-out/graph.html` | `docs/discovery/graph.html` |
| `graphify-out/GRAPH_REPORT.md` | `docs/discovery/GRAPH_REPORT.md` |
| `graphify-out/graph.json` | `.claude/state/discovery/graph.json` |

Copy (do not move) so `graphify-out/` remains intact for re-runs. The Step 3 existence assertion already guarantees `graph.html` and `graph.json` are present; if either is absent at copy time, halt (it indicates a race or tampering).

### Step 4.5: Scout Plan

Before generating shards, inspect the graph to decide whether downstream orchestration (Architect) should use focused **Scout subagents** per-domain rather than read source directly. This preserves the orchestrator's context window on large codebases.

Read `.claude/state/discovery/graph.json` and compute four metrics:

| Metric | Threshold | Source |
|---|---|---|
| Total nodes | > 500 | `graph.json` node count |
| Top-level clusters (communities) | > 6 | `graph.json` community count |
| Largest single cluster | > 150 nodes | max of per-cluster node counts |
| `graph.json` size | > 5 MB | file size on disk |

Thresholds may be overridden by a `brownfield.scoutThresholds` block in `.claude/settings.json`; fall back to the defaults above if absent.

**If any threshold is met**, write `.claude/state/discovery/scout-plan.md` from template `${CLAUDE_PLUGIN_ROOT}/templates/brownfield/scout-plan.md`. Populate one entry per top-level cluster, plus an additional entry for any cluster exceeding 150 nodes (split it by sub-cluster or by file-path prefix). Each entry includes: domain name, rough node count, representative graph node IDs, and a suggested scope question for the scout to answer.

**If no threshold is met**, write a single-line marker file at `.claude/state/discovery/scout-plan.md`:

```
> Scouts not required for this repo (below thresholds: N nodes, C clusters, max cluster M, size S KB).
```

The Architect agent reads this file during spec work (see its Law 11) to decide whether to spawn Scouts.

### Step 5: Reality-Doc Generation

Read `.claude/state/discovery/graph.json` and `docs/discovery/GRAPH_REPORT.md`. Generate the following artefacts:

**Main architecture doc:**
- `docs/specs/brownfield-architecture.md` — from template `${CLAUDE_PLUGIN_ROOT}/templates/brownfield-architecture.md`

**Shard files** (~200 lines each, from templates in `${CLAUDE_PLUGIN_ROOT}/templates/brownfield/`):

| Shard | Template | Content |
|-------|----------|---------|
| Stack | `${CLAUDE_PLUGIN_ROOT}/templates/brownfield/stack.md` | Languages, frameworks, runtimes, build tools, package managers — sourced from graph nodes + config files |
| Data Model | `${CLAUDE_PLUGIN_ROOT}/templates/brownfield/data-model.md` | DB schemas, ORMs, data stores, key entities — sourced from graph clusters + actual model files |
| Flows | `${CLAUDE_PLUGIN_ROOT}/templates/brownfield/flows.md` | Key request/data flows, entry points, API routes — sourced from graph edges + route files |
| Debt | `${CLAUDE_PLUGIN_ROOT}/templates/brownfield/debt.md` | Known tech debt, deprecated deps, complexity hotspots, TODO/FIXME/HACK counts |
| Constraints | `${CLAUDE_PLUGIN_ROOT}/templates/brownfield/constraints.md` | Hard constraints: pinned deps, EOL runtimes, infra limits, compliance requirements |
| Hotspots | `${CLAUDE_PLUGIN_ROOT}/templates/brownfield/hotspots.md` | High-churn files, complexity outliers, coupling clusters — populated in Steps 5 + 6 |

Write each shard to `docs/specs/brownfield/`. If a template does not yet exist, generate the shard using the content description above as the structural guide.

For each shard:
1. Extract relevant clusters and nodes from `graph.json`
2. Read actual source files cited by the graph to fill in detail
3. Cite file paths and graph node IDs inline
4. Stay within ~200 lines; move overflow to an `## Archive` section at the bottom

### Step 6: Git-History Signal

Run git log analysis to surface churn data:

```bash
git log --stat --since=1.year --format="%H %ai" 2>/dev/null
```

If git history is available:
- Identify the top 20 most-changed files (by commit frequency)
- Identify files with the most insertions/deletions (volatility)
- Cross-reference with graph complexity data
- Populate the **hotspots** shard with churn rankings and a table

If no git history is available (not a git repo or brand new), note the absence in the hotspots shard:
```
> No git history available. Churn analysis skipped. Hotspot data based on static complexity only.
```

### Step 7: Discovery Index and Log

**Index file** — Populate `docs/discovery/index.md` from template `${CLAUDE_PLUGIN_ROOT}/templates/discovery-index.md`. The template is the canonical structure; fill placeholders with actual paths and counts.

**Discovery log** — Append an `INGEST` entry to `.claude/state/discovery-log.md` using the schema defined in `${CLAUDE_PLUGIN_ROOT}/templates/discovery-log.md`. Record: graphify command, node/edge counts, cluster count, largest cluster, graph.json size, scout-plan outcome, git-history availability, shards generated, warnings.

### Step 8: Post-Process Mermaid

Extract top-level clusters from `graph.json`. For each of the following shards, generate a focused Mermaid flowchart diagram and embed it:

- **Stack shard**: Component/layer diagram showing major framework boundaries
- **Data Model shard**: Entity-relationship overview of key models
- **Flows shard**: Sequence or flowchart of primary request paths

Each Mermaid block should:
- Use `flowchart TD` or `flowchart LR` as appropriate
- Include max 15 nodes for readability
- Reference graph node IDs in comments
- Render correctly on GitHub without external tooling

### Step 8.5: Coverage Gate

Read `${CLAUDE_PLUGIN_ROOT}/templates/supported-languages.yml`. Run `cloc` or `tokei` (whichever is available; prefer `tokei`) against the repo root. Intersect the LOC-per-language output with the manifest tiers. Write `.claude/state/discovery/coverage.yml`:

```yaml
generated_at: <ISO-8601>
total_loc: <int>
by_tier:
  full: { loc: <int>, pct: <float>, languages: [...] }
  partial-syntactic: { loc: <int>, pct: <float>, languages: [...] }
  unsupported: { loc: <int>, pct: <float>, languages: [...] }
blind_spots:
  - path: <glob>
    language: <name>
    reason: <"unsupported-tier" | "partial-syntactic-excluded-from-deep-artefacts">
```

**Coverage threshold** (default 85%; overridable via `.claude/settings.json` `weave.brownfield.coverage.minPctForDeepArtefacts`):

- If `by_tier.full.pct >= threshold`: proceed with the full Step 5 shard set including C4 Level 3 and Level 4 inputs, and emit drift metrics.
- If `by_tier.full.pct < threshold`: **fail closed on deep artefacts.** Skip C4 L3/L4 and class-diagram emission; emit `architecture.md` with `L3/L4 DRAFT — coverage below threshold` banners; include every unsupported/partial-syntactic path in the `blind_spots:` frontmatter list; disable drift-metric emission in `reconcile --check-drift` until coverage recovers.

Every shard emitted from Step 5 onwards MUST carry the coverage banner at top (below frontmatter):

```
> Coverage: <pct>% of LOC analysed (<excluded languages, if any>)
> See .claude/state/discovery/coverage.yml for per-language breakdown.
```

### Step 9: Context Scaffold — Nested CLAUDE.md Emitter

Emit the hierarchical CLAUDE.md system so the engineer agent loads the right domain context on demand.

**Inputs**: `.claude/state/discovery/graph.json` (clusters + node paths), `.claude/state/discovery/coverage.yml`, `docs/specs/brownfield/*.md` (for heading anchors to link to).

**Process**:

1. **Identify domain directories.** For each top-level cluster in `graph.json`, compute the representative directory: the shortest path prefix that contains the majority of cluster node files. That directory is the domain root.
2. **Emit domain CLAUDE.md.** For each domain directory, write `<domain-dir>/CLAUDE.md` from `${CLAUDE_PLUGIN_ROOT}/templates/context/domain-claude.md`. Populate:
   - Domain name and one-line purpose (derived from cluster centrality + README if present).
   - Coverage banner from `coverage.yml`.
   - "Read before touching" pointers to relevant sections of `docs/architecture/*.md` using **heading anchors** (`#domain-slug`), never `:line` numbers.
   - Top 3 entry points by graph centrality, cited as `file#symbol`.
   - Applicable rules: scan `.claude/rules/*.md` frontmatter `scope:` globs; list rules whose glob matches this domain's path.
   - Gotchas: cross-reference `.claude/state/context/tribal-knowledge.md` lines tagged with this domain.
   - Invisible edges: pull from `docs/architecture/flows.md#invisible-edges` where the domain appears as source or destination.
   - `## Human notes` preserved section at bottom — if a prior CLAUDE.md exists at this path, extract any content below `## Human notes` and re-insert verbatim. Never overwrite.
3. **Emit sub-package CLAUDE.md** for sub-clusters > 150 nodes (same template). Stop at depth 3 (project → domain → package). Deeper clusters collapse into the nearest package CLAUDE.md.
4. **Enforce line budgets.** Every emitted CLAUDE.md must be ≤100 lines. If a template fills past 100, prune the lowest-centrality pointers and log the truncation to `.claude/state/discovery-log.md`.
5. **Update root `.claude/CLAUDE.md`.** Keep ≤60 lines. Must include a "Domain index" section listing every emitted `<path>/CLAUDE.md` as `- [<domain-name>](<path>/CLAUDE.md) — <one-line purpose>`. If root CLAUDE.md already has a `## Human notes` section, preserve verbatim.

**Anchors, not line numbers.** Every pointer uses `file.md#heading-anchor`. Anchors must resolve — `reconcile` Mode B check B7 will fail the build if they do not.

**Graph-cluster-informed, never filesystem-arbitrary.** Do not emit a CLAUDE.md just because a directory exists; emit only where Graphify identifies a cluster boundary. This keeps the hierarchy aligned with actual coupling, not filesystem quirks.

### Step 10: Print Summary

Display completion summary:

```
Brownfield discovery complete.
  Reality doc:   docs/specs/brownfield-architecture.md
  Shards:        docs/specs/brownfield/ (6 files)
  Architecture: docs/architecture/ (current-state tree)
  Coverage:      .claude/state/discovery/coverage.yml (<pct>% full-tier)
  CLAUDE.md:     root + <N> domain files
  Interactive:   open docs/discovery/graph.html
  Full report:   docs/discovery/GRAPH_REPORT.md
  Discovery log: .claude/state/discovery-log.md

Next steps:
  Review the current-state architecture tree and CLAUDE.md hierarchy for accuracy.
  Run /interview <role> to capture SME nuance and promote rule candidates.
  The Architect agent will use these as input for tech-spec generation.
```

## Edge Cases

- **Monorepo with multiple package.json files**: Run `graphify` from the repo root. Note the monorepo structure in the stack shard. Each workspace should appear as a distinct cluster in the graph.
- **No git history**: Skip Step 6 churn analysis. Note absence in hotspots shard. Static complexity analysis still applies.
- **Graphify fails or produces empty output**: Halt with error. Do not generate shards from assumptions.
- **Very large codebase**: If `graph.json` exceeds 50MB, warn the user and suggest running `graphify` with `--exclude` flags to reduce scope. Proceed with available data.
- **Missing templates**: If a brownfield template file does not exist in `${CLAUDE_PLUGIN_ROOT}/templates/brownfield/`, generate the shard using the content descriptions in Step 5 as the structural guide.
- **Graphify does not produce `graph.html`**: An older graphify version (or a silent extractor failure) may emit only `graph.json` and the report. The Step 3 existence assertion catches this and halts explicitly rather than silently continuing with a missing interactive graph. Resolution: upgrade graphify (`uv tool install --upgrade graphifyy`) and re-run.
