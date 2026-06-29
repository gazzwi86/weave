---
name: okf-visualize
description: >-
  Render the docs/ OKF bundle as a self-contained interactive HTML knowledge
  graph (docs/viz.html). Concepts become colour-coded nodes, markdown
  cross-links become edges, clicking a node shows its full content. No backend
  required — open the file in any browser. The file is gitignored; regenerate
  on demand.
user-invocable: true
argument-hint: "[--layout cose|concentric|breadthfirst|circle|grid]"
allowed-tools: Bash
---

# /okf-visualize — interactive knowledge graph renderer

Renders the unified `docs/` bundle (wiki + specs + standards) as a self-contained
Cytoscape.js HTML graph at `docs/viz.html`. No backend required; all data is
embedded as JSON.

The graph shows:
- **Nodes** — one per concept, coloured by `type`, sized by content length
- **Edges** — markdown cross-links between concept files
- **Panel** — click any node to see its rendered markdown, outgoing links, and
  "Cited by" backlinks

## Arguments

`$ARGUMENTS` — forwarded to the renderer.

- **`--layout`** — initial graph layout: `cose` (force, default), `concentric`,
  `breadthfirst`, `circle`, `grid`
- **`--exclude <path>`** — file or directory to omit from the graph (repeatable)

## Procedure

```bash
uv run .claude/scripts/okf_visualize.py docs -o docs/viz.html $ARGUMENTS
```

Then open `docs/viz.html` in a browser.

## Notes

- `docs/viz.html` is gitignored — regenerate after `/anatomy` or spec updates.
- Reserved OKF files (`index.md`, `log.md`) are excluded from the graph (they are
  navigation aids, not concepts).
- `/anatomy` triggers this automatically on full regeneration (not in `refresh` mode).
