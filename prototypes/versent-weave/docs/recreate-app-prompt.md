# Prompt — recreate the interactive strategy knowledge-graph app

> A self-contained prompt for a code-generating LLM. It reproduces the **features,
> interactions and look** of the radial "strategy on a page" graph app, driven by
> generic **example** data (not any real dataset). Paste everything below the line
> into a fresh model. It has been adversarially reviewed for completeness, technical
> correctness (Cytoscape.js), and one-shot reliability.

---

Build a single, self-contained, interactive **strategy knowledge-graph** web app as
ONE HTML file (inline CSS + JS, no build step, no framework, no bundler). It must
open directly in a browser from the filesystem (`file://`) with no server. Use
**Cytoscape.js 3.30.2** from cdnjs for the graph and Google Fonts **Space Grotesk**
(display), **Inter** (body), **JetBrains Mono** (mono); everything else is
hand-written vanilla JS + CSS. (A network connection is needed on first load for the
CDN + fonts; nothing else is server-dependent. `<link rel="preconnect">` the font
origins and do NOT block layout on font load.)

The app visualises "a strategy on a page": a central **goal** node with everything
else radiating outward in concentric rings, showing how the pieces compose to reach
that goal. Build it generic — drive it entirely from the data arrays below so the
domain can be swapped by editing data only.

## OUTPUT REQUIREMENTS (read first)
- **Emit the entire HTML file in one response with zero omissions** — no ellipses,
  no `// ...`, no `TODO`, no placeholder comments standing in for code, no "rest
  unchanged". Every feature in §4 (A–J) must be fully implemented in emitted code.
- **Expect a large file** (well over a thousand lines once all of §4 is done).
  Completeness always wins over brevity — never drop or thin a feature to make the
  file shorter. If it's long, keep going and finish it.
- Add **no** features, panels, views, or controls beyond those specified here.
- Organise the code in clearly commented sections: data → CLS/EDGE_TYPES → rings
  layout → build → styles → interactions → search → filters → drawer/notes →
  tooltips → story → modals → keyboard.

================================================================================
## 1. DATA MODEL  (use this example dataset verbatim — illustrative placeholder data)
================================================================================
Two arrays are the single source of truth.

`NODE = { id, label, cls, status:'live'|'emerging', desc }`
`EDGE = [ fromId, toId, type ]`

Node classes (`cls`) — exactly these ten, each with one distinct colour and a
display label, in a `CLS` registry `{ cls: {c:'#hex', label:'…'} }`:
```
core       #39ff7a  "Core goal"     (exactly ONE node)
pillar     #62d98a  "Enabler"
cap        #ffb84d  "Capability"
asset      #ff6b6b  "Asset"
offering   #c08bff  "Offering"
initiative #ff9d3c  "Initiative"
tool       #c8cdd6  "Tool"
ritual     #8fd6ff  "Ritual"
practice   #3fd9c4  "Practice"
partner    #9aa6b8  "Partner"
```

Edge types — exactly these seven verbs, in an `EDGE_TYPES` registry
`{ type: {c:'#hex', style:'solid'|'dashed'|'dotted', arrow:bool, label:'…'} }`,
plus a `VERB_DEF` map of one-line meanings. Edge colours are a deliberately MUTED,
mutually-distinct set that does NOT reuse any node hue:
```
enables     #e2e9f2  solid   arrow:true   "makes possible / empowers"
comprises   #565c66  solid   arrow:true   "is made up of"
delivers    #73c8a3  dashed  arrow:true   "produces the value of"
uses        #6aa6e0  dotted  arrow:true   "draws on at run time"
intersects  #9aa1ab  solid   arrow:false  "shares membership / spans"
instance-of #b89ad8  dashed  arrow:true   "is an example of"
informs     #cba98a  dotted  arrow:true   "feeds knowledge into"
```

EXAMPLE DATASET to ship (theme: a fictional company becoming **"Data-Driven"**;
18 nodes, all ten classes present, both statuses present). Use these nodes verbatim:
```
core:       datadriven   "Data-Driven"          emerging   (the goal)
pillar:     culture      "Culture"              live
pillar:     platform     "Platform"             live
pillar:     people       "People"               live
pillar:     governance   "Governance"           live
cap:        analytics    "Analytics"            live
cap:        ml           "Machine Learning"     emerging
tool:       warehouse    "Cloud Warehouse"      live
tool:       bi           "BI Suite"             live
asset:      featurestore "Feature Store"        emerging
offering:   insights     "Insights Service"     emerging
offering:   dataproduct  "Data Products"        live
initiative: modernise    "Data Modernisation"   live
partner:    cloudvendor  "Cloud Vendor"         live
ritual:     guild        "Data Guild"           live
ritual:     hackathon    "Hackathon"            live
practice:   dataeng      "Data Engineering"     live
practice:   datasci      "Data Science"         emerging
```
Give every node a short one-sentence `desc` of your own writing.

**Use exactly the edges listed below, verbatim — do not add, drop, or rewire any.**
(They are arranged so every verb is used and the graph is connected: pillars
`enables` the core; pillars `comprises` their leaves; practices `delivers`
offerings; practices/caps `uses` tools & partners; Culture `intersects` People;
assets/caps are `instance-of` a capability; `informs` edges feed knowledge back.)
```
[culture,datadriven,enables] [platform,datadriven,enables]
[people,datadriven,enables] [governance,datadriven,enables]
[platform,warehouse,comprises] [platform,bi,comprises]
[people,dataeng,comprises] [people,datasci,comprises]
[culture,guild,comprises] [culture,hackathon,comprises]
[dataeng,dataproduct,delivers] [datasci,insights,delivers]
[dataeng,warehouse,uses] [datasci,ml,uses] [datasci,featurestore,uses]
[dataeng,cloudvendor,uses] [analytics,bi,uses]
[culture,people,intersects]
[ml,analytics,instance-of] [featurestore,ml,instance-of]
[cloudvendor,modernise,enables] [modernise,datadriven,enables]
[modernise,featurestore,delivers]
[guild,analytics,enables] [hackathon,ml,enables]
[analytics,people,informs] [ml,people,informs]
[datasci,analytics,uses] [governance,dataproduct,uses]
```

================================================================================
## 2. LAYOUT — deterministic radial "rings" (the only view; add no alternates)
================================================================================
Compute positions ONCE on load and feed them to a Cytoscape **`preset`** layout (a
`{id: {x,y}}` map) — never a physics/force sim. Store the map and reuse it on every
fit/reset.

1. **RING (radius)** = undirected BFS hop-distance from the single core node. Build
   an undirected adjacency from EDGES (push both directions), BFS from the core. A
   node BFS never reaches (unwired) goes one ring beyond the deepest.
2. **PARENT** (the inward node a node clusters beneath) = among its neighbours one
   ring closer, pick by edge-type preference so structural links beat weak
   cross-links. Preference (lower = preferred):
   `enables < comprises < intersects < instance-of < delivers < uses < informs`.
   **Break ties by EDGES array order (first wins)** so layout is identical every
   reload. Nodes with no inward neighbour hang off the core.
3. **ANGLE** — lay the parent→children tree into angular wedges:
   - The core owns the full `0..2π`, starting at `-π/2` (12 o'clock).
   - **Only the core's direct children partition the core's wedge.** Every deeper
     node receives a **sub-wedge of its parent's wedge** (children partition
     `[parentStart, parentEnd]`, NOT the full circle) and recurses with that
     sub-wedge as its new bounds.
   - Within a parent's wedge, size each child's sub-wedge by a blend of equal-share
     and subtree leaf-weight (≈ `0.5*equalShare + 0.5*weightShare`), **normalised so
     the children's sub-wedges sum exactly to the parent's wedge width** (no
     overflow, no gaps).
   - Place each node at the **angular midpoint** of its own sub-wedge. A node with a
     single child passes its wedge straight through (no spread).
   - Position: radius = `ring * R` (R ≈ 200) at the node's angle, offset to a fixed
     centre.
   The exact blend formula is a **guideline, not a spec**: any fully deterministic
   radial placement that reads as clean concentric rings, doesn't overlap, and is
   identical on every reload is acceptable. Prefer a simple correct implementation
   over matching the formula precisely.

================================================================================
## 3. VISUAL DESIGN & RENDERING
================================================================================
Dark, near-black canvas (`#000`, panels `#0c0e0c`, panel edges `#1c211c`), accent
neon green `#39ff7a`. The Cytoscape mount (`#cy`) MUST fill the viewport with an
explicit non-zero size (e.g. `position:fixed; inset:0` behind the header/dock/
drawer); construct `cytoscape({container})` only after that element is in the DOM
(script at end of `<body>`), then call `cy.resize()` and `cy.fit(null, 60)`.

NODE: dark fill, 2px border in the node's class colour; label in display font BELOW
the node (`text-valign:'bottom'`, small `text-margin-y`), wrapped (`text-wrap:'wrap'`,
`text-max-width ≈ 110px`). Per-class size/shape, mapped via `node[cls="…"]`
selectors using Cytoscape's EXACT shape strings:
  - core → `ellipse`, large (~52px), neon-green glow (shadow), bright **centred**
    label (`text-valign:'center'`), top z-index;
  - pillar → `ellipse` ~30px; offering → `ellipse` ~24px;
  - **cap → `round-diamond`** ~24px; **asset → `round-rectangle`** (~22×18);
  - everything else → base `ellipse` ~16px.
  (Invalid shape strings like `rounded-diamond` are silently ignored — use the exact
  tokens above.)
STATUS cue via `border-style`: `live` = `solid`, `emerging` = `dashed`.

EDGE: `curve-style:'bezier'`; `line-color`/`target-arrow-color` from the type's
colour; `line-style` from the type (`solid|dashed|dotted`); widen the gap with
`line-dash-pattern` so dotted ≠ dashed read distinctly on bezier curves (e.g. dashed
`[7,4]`, dotted `[1.5,4]`). Map the registry `arrow` flag in style as
`target-arrow-shape: e => EDGE_TYPES[type].arrow ? 'triangle' : 'none'` (so
`intersects` has none); `arrow-scale ≈ 0.85`; base `opacity ≈ 0.72`; `enables`
slightly thicker/brighter (it's the backbone to the goal). Optionally add a subtle
dark `text-outline` on labels for legibility over edges.

================================================================================
## 4. UI REGIONS & FEATURES  (implement all)
================================================================================
(A) **HEADER** (top bar): brand title + small subtitle (left); on the right a SEARCH
    input, a "▶ Story" button, a "↳ Labels" toggle, and a "?" About button. Buttons
    share a mono-font pill style with a green hover/active state.

(B) **SEARCH**: live, case-insensitive substring match over label + class label +
    desc (precompute a lowercased haystack per node). Dropdown of up to ~12 hits,
    each a coloured class dot + label + class name. Keyboard: ↑/↓ move selection,
    Enter jumps to the selected hit, Esc closes & blurs. Click also jumps. "Jump" =
    clear focus, focus-highlight that node, animate center+zoom to it, open its
    drawer. Global shortcut: `/` or ⌘/Ctrl-K focuses search (when not already
    typing in it). Click-away closes the dropdown. Show a "No matches" row when
    empty.

(C) **FILTER DOCK** (floating, top-left, frosted/translucent) — single source of
    truth for filters:
      - "Relationships": one toggle row per edge type, each with a short line swatch
        drawn in that type's colour + style, plus its label.
      - "Node type": one toggle row per class, each with a colour dot + label.
      - A status segmented control: All / Live / Emerging.
      - A "Reset" button and a count line `Live N · Emerging M · T total`
        (counts the full dataset).
    **Hide mechanism:** toggle a `hidden` class whose CSS is `display:none` (so it
    composes correctly with focus dim/hl — see (E)). A node is hidden if its class
    is off OR it fails the status filter — **except the core node, which is exempt
    from the status filter and always shown** (it anchors the layout). An edge is
    hidden if its type is off OR either endpoint is hidden. Toggling a row dims it
    (`aria-pressed`). If nothing is visible, show a centered "Nothing matches the
    current filters" empty-state overlay with a "Show all" button (= Reset). Reset
    restores all toggles + status=All. Dock scrolls if tall.

(D) **DETAIL DRAWER** (right side panel, slides in; bottom sheet on narrow screens):
    opens on node tap and via search-jump. Shows:
      - two chips — class (in class colour) and status (live=green / emerging=amber);
      - title (large display font) + description;
      - "Connections": every incident edge as a row — direction arrow (→ outgoing /
        ← incoming) + verb + the other node's label as a clickable link that jumps
        to it;
      - "Capture notes": a textarea + "Add note" button. Notes stored PER NODE in
        localStorage (key `app:notes:<id>`) as `{text, at}` with a friendly
        timestamp, listed newest-first, each deletable, persisting across reloads.
        With no notes show a muted "No notes yet" placeholder. If localStorage
        throws, fall back to an in-memory store and show "Saved this session only"
        instead of "Saved · persists in this browser".
      - Close via ✕ or Esc.

(E) **FOCUS / HIGHLIGHT + FIT**: tapping a node dims the whole graph and highlights
    only its closed neighbourhood (itself + direct neighbours + connecting edges) via
    a `dim`/`hl` class scheme (`dim` ≈ 0.15 opacity). A "⤢ Fit" button (bottom-left)
    clears focus and animates to fit all. `clearFocus` removes only `dim`/`hl`.
    **Filter-hidden elements (`display:none`) always take precedence over dim/hl**,
    and `clearFocus` must not reveal a filter-hidden node; changing filters while
    focused simply re-applies over the new visible set.

(F) **HOVER TOOLTIPS** (cursor-following, `pointer-events:none`, fixed position):
    hovering a NODE shows class label + node label + description + a note-count line
    ("N notes · click for detail" / "click for detail + notes"). Hovering an EDGE
    shows "<source> <verb> <target>" (verb coloured) + the verb's one-line meaning.
    Hide on mouseout and on pan/zoom/drag.

(G) **STORY TOUR**: an ordered array of steps `{ title, caption, selector }` where
    selector picks nodes to spotlight — use **class selectors** like
    `node[cls="pillar"]` or comma-separated id lists (never `#core`; the core's id is
    `datadriven`). A bottom banner shows step title + caption + "‹ Back" / "Next ›"
    (last step "Done") + a `k / N` progress label + ✕ close. Advancing a step:
    highlight just those nodes (+ edges between them), fit the viewport to them, and
    close the drawer. **Guard every fit/center/animate against an empty collection
    (`if (coll.empty()) return;`)** — never animate to nothing. Back hidden on step
    1; "Done"/closing clears focus and Fits the whole graph. Provide ~8–10 steps
    walking goal → enablers → practices → offerings → flywheel → initiative →
    partners → capabilities → "now explore" for the example data.

(H) **WELCOME MODAL** on load: brand title + a short framing paragraph + two buttons
    "▶ Take the guided tour" (starts Story at step 0) and "Explore the map" (closes).
    Dismiss on backdrop click or Esc.

(I) **ABOUT MODAL** (from "?"): how to read the graph; a legend of the seven verbs
    with meanings; the ten node types with colour swatches (built from CLS);
    optionally a short glossary. Dismiss on backdrop click, ✕, or Esc.

(J) **LABELS TOGGLE** ("↳ Labels"): toggles the edge-type text label on every edge
    on/off; the button shows active state.

================================================================================
## 5. INTERACTION / KEYBOARD / POLISH
================================================================================
  - Esc closes any open overlay (drawer, modals, story banner, search dropdown) and
    clears focus.
  - `/` or ⌘/Ctrl-K focuses search (Search is the documented keyboard entry point
    to the canvas-rendered graph).
  - Respect `prefers-reduced-motion`: it must disable BOTH CSS transitions AND all
    Cytoscape `animate:true` viewport moves (fit/center/zoom become instant).
  - `:focus-visible` outlines on interactive controls; sensible aria (drawer
    `aria-hidden`, filter rows `aria-pressed`, dialog roles on modals).
  - Responsive: on narrow screens the drawer becomes a bottom sheet and the dock
    shrinks; hide the subtitle.
  - **Escape all data-derived text** before inserting as HTML (a label/desc with
    `<`, `&`, `"` must render literally and break nothing).
  - Sensible zoom limits and wheel sensitivity so the graph can't be lost.

================================================================================
## 6. ACCEPTANCE CRITERIA  (the finished file must satisfy all)
================================================================================
Before emitting, walk every box below against the code you are about to output and
fix any that fail. Do not narrate this check — just ship a file that passes all.

  [ ] One HTML file; opens from `file://` with no server/build; only Cytoscape +
      fonts load remotely; `#cy` fills the viewport and the graph paints (no blank
      canvas) with **no console errors** on load or interaction.
  [ ] Renders the example graph as clean concentric rings around the single core,
      computed deterministically (identical layout every reload).
  [ ] Every node class and every edge verb is present and distinguishable by colour
      AND (edges) line-style; cap=diamond & asset=round-rect shapes render; live vs
      emerging distinguishable by border.
  [ ] Search filters live, supports ↑/↓/Enter/Esc, jump centres + opens the drawer;
      `/` and ⌘K focus it; "No matches" shows when empty.
  [ ] Edge-type, node-type and status filters hide/show correctly (via
      `display:none`); the core never disappears under status=Live; empty state
      appears when nothing matches; Reset restores everything.
  [ ] Clicking a node opens the drawer with chips, description, working clickable
      connections, and notes that persist in localStorage across reloads (with the
      in-memory fallback + correct save-state text + "No notes yet" placeholder).
  [ ] Hover tooltips for nodes and edges show the right content and follow the cursor.
  [ ] Story steps through with spotlight+fit (no empty-collection animation errors);
      Welcome & About modals work; Labels toggle works; Fit works; Esc + shortcuts
      work.
  [ ] Focus dim/hl and filter-hide compose correctly (hidden always wins; clearFocus
      never reveals a hidden node).
  [ ] All data-derived text is HTML-escaped; `prefers-reduced-motion` disables CSS +
      Cytoscape animations; drawer becomes a bottom sheet on narrow screens;
      aria/focus-visible present.

Default to the look described above; you may refine spacing, shadows and
micro-interactions for polish only — adding no features beyond §1–§6.
