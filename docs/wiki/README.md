---
type: Bundle Guide
title: docs/wiki — Weave Code Knowledge Bundle
description: OKF v0.1 bundle of code-area anatomy pages, maintained by /anatomy. One concept per source area.
tags: [wiki, anatomy, okf, meta]
timestamp: 2026-06-29T00:00:00Z
---

# docs/wiki — Weave Code Knowledge Bundle

An **OKF v0.1** bundle: a navigable, semantic index of the codebase as plain markdown with
YAML frontmatter. Generated and maintained by `/anatomy`; consumed by agents and humans.

## Structure

```
docs/wiki/
├── index.md          # OKF bundle root — directory listing (no frontmatter except okf_version)
├── log.md            # OKF change history — newest entry first, ISO 8601 dates
├── README.md         # This file
└── <area>.md         # One OKF concept per code area (e.g. web.md, src-api.md)

docs/viz.html         # Interactive Cytoscape.js graph — gitignored, generate on demand
                      # Spans the full docs/ bundle (wiki + specs + standards)
```

One page per **area**, where `<area>` maps from source path via
`.claude/scripts/modules/common.py::area_for_path` (e.g. `apps/web/…` → `web.md`,
`packages/core/…` → `core.md`, `src/api/…` → `src-api.md`).

Only source under the tracked roots `apps/ packages/ infra/ src/ lib/` gets a page.

## OKF format

Every area page is an OKF concept — a markdown file with a YAML frontmatter header:

```yaml
---
type: Code Area          # required — identifies concept kind
title: web — Next.js SPA # human-readable name
description: ...         # one-sentence summary
tags: [nextjs, frontend] # queryable metadata
timestamp: 2026-06-29T12:00:00Z
---
```

Cross-links between area pages use standard markdown: `[src-api](src-api.md)`.

## Workflow

| Command | Effect |
|---|---|
| `/anatomy` | Full regeneration — all areas + index.md + log.md + viz.html |
| `/anatomy refresh <files>` | Incremental — only areas containing changed files |
| `/okf-validate` | Conformance check against OKF v0.1 §9 |
| `/okf-visualize` | Render `docs/viz.html` (interactive graph of full docs/ bundle) |

The `mark-anatomy-stale` PostToolUse hook appends `<!-- stale: <path> -->` markers when
a tracked source file changes; `/anatomy refresh <files>` regenerates the page and clears
them. The pre-push hook blocks if any stale markers remain.

## Visualizing the graph

```bash
uv run .claude/scripts/okf_visualize.py docs/ -o docs/viz.html
open docs/viz.html
```

The interactive graph lets you:
- Browse concepts by type (colour-coded)
- Filter by type or free-text search
- Click any node to see its full content + cross-links + "Cited by" backlinks
- Switch between force / concentric / breadth-first / circle / grid layouts

Pages appear here once product source exists. Do not hand-edit — run `/anatomy`.
