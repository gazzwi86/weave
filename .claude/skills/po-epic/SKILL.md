---
name: po-epic
description: Produce a single Epic file (EPIC-NNN.md) for a Weave spec entity, one section at a time with HITL. Invoked repeatedly by the product-owner agent, once per epic, until all epics for a PRD are complete.
---

> **Consolidated-spec output (post-merge layout).** Every PO artifact for an entity lives as a
> **section inside one file**: `docs/specs/weave/engines/<entity>.md`. This skill writes/updates
> **only its own section** and MUST NOT overwrite others — `## Brief` (po-brief),
> `## Product Requirements (PRD)` (po-prd), `## Epics` with one `### EPIC-NNN` subsection per epic
> (po-epic), `## Roadmap` (po-roadmap). If the file does not yet exist, create it with merged
> frontmatter (per `.claude/spec-templates/frontmatter-schema.md`) and a `# <Engine>` heading, then
> add your section. Determine the next `EPIC-NNN` by scanning existing `### EPIC-` headings **within
> this file** (max + 1) — there is no per-epic file or `epics/` directory any more. Architect
> artifacts (tech spec, tasks, ADRs) remain **files** under
> `docs/specs/weave/engines/<entity>/{tech-spec,decisions}/` and `<entity>/<milestone>/tasks/` — tasks are grouped by roadmap milestone (m1, m2, v1, post-v1); tech-spec/ and decisions/ are engine-level living artifacts; the active milestone today is m1.

# PO Epic Skill

Produce a single Epic file (`EPIC-NNN.md`) for a Weave spec entity, one section at a time with
HITL review at every section. Invoked repeatedly by the PO agent — once per epic — until all
epics for a PRD are complete.

## Model

- **Drafting phase:** claude-sonnet-5 (structured output, precise prose, story/AC generation)

Fable is not used here: the PRD has already set the strategic frame. Sonnet's structured
generation is sufficient for translating PRD epics into well-formed EARS-notated AC.

## Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave product context, confirmed stack — and `.claude/rules/plugin-laws.md` (Plugin Laws A-F)
2. `.claude/spec-templates/epic.md` — section structure (use as scaffold, never leave `{{}}` in output)
3. `docs/specs/weave/engines/<entity>.md` — the parent PRD; locate the epic section that this file
   will cover (section heading, priority, linked stories)
4. `docs/specs/weave/engines/<entity>.md` — scan existing EPIC-NNN.md files to determine the next
   sequence number (zero-pad to 3 digits: 001, 002, …)
5. Any existing draft of this epic if present (to continue rather than restart)

Ask the user which entity and which epic (name or PRD section heading) if not supplied as
arguments. Derive the output path as:

`docs/specs/weave/engines/<entity>.md`

## Instructions

### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs an epic before writing anything else.

Example: "An epic's job is to define a coherent, deliverable slice of product value with
testable cross-cutting constraints. If the epic's ACs are a tautological restatement of its
stories being done, the epic has failed. Every AC must assert something that can fail even
when all story-level ACs pass."

Reference this principle when justifying EARS notation and AC quality during the HITL loop.

### Step 1 — Context ingestion

1. Read all files listed in the Input section above.
2. Identify the target epic in the PRD — its title, phase reference, priority, and any
   user stories or FRs already attributed to it.
3. Summarise what you know in 3 bullets before proceeding:
   - What the epic delivers (from the PRD)
   - What stories are already listed in the PRD (or "none yet defined")
   - What dependencies are visible from the PRD or roadmap

Ask via AskUserQuestion:

- "How do you want to supply the user stories for this epic?"
  Options: Stories already in PRD / Derive from PRD FRs / Provide them now / Blank slate

### Step 2 — Confirm story list before writing

Before writing the User Stories table, surface the proposed story list and get explicit sign-off.

1. Draft the story list as a numbered plain-text list (not the table yet):
   - Each entry: `TASK-NNN — <title> (Priority)`
   - Include a brief one-line rationale for each story
2. Ask via AskUserQuestion:
   - "Does this story list look right?"
     Options: Approved / Add stories / Remove stories / Reorder / Rewrite titles

Only proceed to section-by-section production once the story list is approved. Never write
the table from an unconfirmed list.

**Story ID assignment rules:**
- IDs are TASK-NNN (zero-padded, three digits)
- Scan `docs/specs/weave/engines/<entity>.md` for existing tasks to avoid collisions
- If no existing epics, start at TASK-001 for EPIC-001, TASK-XXX for subsequent epics
  (continue the sequence across all epics in the entity, never restart at 001)

### Step 3 — Section-by-section production

Produce the epic in this exact order. For each section:

1. **Write** the section to the file
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated
3. **Present** the section to the user (display the written content)
4. **Emit a confidence block** (see below) immediately before the HITL question
5. **Ask** via AskUserQuestion: Approve / Amend / Reject
6. If Amend: apply changes, show diff, re-present with updated confidence block
7. If Reject: regenerate with a cleaner approach, show the new version

**Sections in order:**

#### Overview

Four fields from the template:

- **Phase:** reference the roadmap phase (e.g. `Phase 1 — Constitution Engine`)
- **PRD Reference:** relative link to the parent PRD section
  (e.g. `[prd.md](../prd.md#epic-constitution-engine-core)`)
- **Status:** always `Backlog` for a new epic
- **Priority:** derive from PRD (`Must Have` / `Should Have` / `Could Have`)

Do not invent phase names — use exact phase headings from the roadmap.

#### Description

2-3 sentences maximum. Cover:

1. What this epic delivers (the concrete system capability, not a vague goal)
2. Why it matters (consequence for the product if this epic is skipped or deferred)

Bad: "This epic covers the core functionality of the Constitution Engine."
Good: "This epic delivers the RDF triple-store persistence layer (Oxigraph) and the
SPARQL query API that all downstream agents and UI components depend on. Without it,
no other Weave sub-system can store or retrieve semantic data, making this the hard
dependency for every subsequent epic."

#### User Stories table

Use the approved story list from Step 2. Format exactly as the template:

| Task ID | Title | Status | Priority |
|---------|-------|--------|----------|

Rules:
- Status is `Backlog` for all new stories
- Title must be meaningful: a reader must understand the story from the title alone
- Priority must be one of: `Must Have`, `Should Have`, `Could Have`
- Deliver the table in batches of 5 rows; ask Approve / Add / Amend after each batch
- Never include implementation details in story titles (those live in task files)

#### Acceptance Criteria (Epic Level)

Epic-level ACs assert cross-cutting concerns that span multiple stories. They must be
capable of failing even when every story-level AC passes.

**EARS notation is MANDATORY** for all ACs:
Format: `WHEN [event] THE SYSTEM SHALL [behaviour]`

**Anti-pattern (do not write these):**
- "All stories complete and passing." — tautological, adds no constraint
- "The feature works correctly." — unmeasurable
- "Performance is acceptable." — no threshold defined

**Good patterns:**
- Spans all stories: "WHEN any SPARQL query is submitted against the Constitution Engine
  endpoint THEN THE SYSTEM SHALL return results within 2 000 ms at p95 under a 50-user
  concurrent load, measured by the Locust load-test suite in CI."
- Cross-cutting security: "WHEN an unauthenticated request reaches any Constitution Engine
  API endpoint THEN THE SYSTEM SHALL return HTTP 401 and log the attempt to CloudWatch."
- Integration coherence: "WHEN all stories in EPIC-001 are deployed to staging THEN THE
  SYSTEM SHALL pass the full Constitution Engine integration test suite (`pytest -m integration`)
  on a clean checkout with no manual edits."
- Data integrity across stories: "WHEN a SHACL validation error is raised by any triple-store
  write THEN THE SYSTEM SHALL reject the write, return a structured error payload, and leave
  the graph in its pre-write state."

Write 3-6 ACs. Every AC must:
- Use EARS `WHEN … THE SYSTEM SHALL …` format
- Name a measurable outcome (threshold, test command, HTTP code, log event)
- Reference Weave stack specifics (Oxigraph, SPARQL, CloudWatch, pytest, Playwright) where relevant

Deliver in batches of 3; ask Approve / Add / Amend after each batch.

#### Dependencies

Two sub-fields:

- **Blocked by:** epics, external systems, or decisions that must resolve before this epic
  can start (e.g. `EPIC-000 — Platform Scaffold`, `AWS Cognito tenant provisioned`)
- **Blocks:** epics or deliverables that cannot start until this epic is complete

If neither direction has dependencies, write `None` (never leave blank).
Cross-check against the PRD dependency section and roadmap ordering.

#### Technical Notes

Cross-cutting concerns, shared patterns, or architectural decisions that apply to all stories
in this epic. Write as bulleted prose. Examples of what belongs here:

- Shared authentication pattern for all endpoints in this epic
- ORM / SPARQL client library version constraints
- AWS Lambda cold-start budget that all functions must respect
- Naming conventions for RDF graphs or SPARQL named graphs
- LocalStack configuration required for integration tests (Plugin Law F)
- Shared Pydantic models or TypeScript interfaces used across stories

Do NOT write per-story implementation details here — those belong in task files.
If there are no cross-cutting concerns, write one sentence saying so; never leave blank.

### After all sections approved

0. Append a `# Related` section linking predecessor documents with path-relative markdown
   links. **Link only files that exist on disk now.** Predecessor (always exists): the PRD —
   `[prd.md](../prd.md)`. Link sibling epics in the same `epics/` directory only if already
   written. Do not forward-link task briefs (`../../<milestone>/tasks/*.md`) until they exist.

1. Update the epic footer line from the template to:
   `*Generated by Weave PO skill (po-epic).*`
   (replaces "Generated by Weave Architect agent.")

2. Commit the epic file:

```bash
git add docs/specs/weave/engines/<entity>.md
git commit -m "docs(<entity>): add EPIC-NNN <epic-title-slug>"
```

3. Tell the user:
   "EPIC-NNN complete. Run `/po-epic` again to write the next epic, or run `/architect`
   to begin the tech spec when all epics are done."

## Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first):   complied | violated | N/A — <reason>
Plugin Law B (testable):             complied | violated | N/A — <reason>
Plugin Law C (council quality):      complied | violated | N/A — <reason>
Plugin Law D (stacked PRs):          complied | violated | N/A — <reason>
Plugin Law E (complexity budget):    complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
Epic Law 1 (EARS ACs):               complied | violated | N/A — <reason>
Epic Law 2 (non-tautological ACs):   complied | violated | N/A — <reason>
Epic Law 3 (story list confirmed):   complied | violated | N/A — <reason>
Epic Law 4 (section-by-section):     complied | violated | N/A — <reason>
Epic Law 5 (small batch tables):     complied | violated | N/A — <reason>
```

**Epic-specific laws:**

- **Epic Law 1** — Every AC uses EARS notation (`WHEN … THE SYSTEM SHALL …`). No exceptions.
- **Epic Law 2** — No AC is tautological. Each AC must be capable of failing when all
  story-level ACs pass.
- **Epic Law 3** — Story list confirmed by user (Step 2) before the table is written.
- **Epic Law 4** — Sections produced one at a time. No multi-section dumps.
- **Epic Law 5** — Tables delivered in batches of ≤ 5 rows with HITL between batches.

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

## Confidence block (emit before every HITL question)

Output this block immediately after presenting the section, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific bullet, sentence, AC, or table row>
Why: <1 sentence — what input was missing or what was assumed>
</section-confidence>
```

Rules:
- Always name the weakest part, even on high-confidence sections.
- "Why" must reference a specific input gap, not a generic hedge.
- The block lives in chat only — do not embed it in the file.

Low confidence triggers: no PRD section found for this epic; story list had to be inferred
from FRs with no explicit grouping; AC thresholds (latency, concurrency) not specified in PRD.

## Output

**Target:** a `### EPIC-NNN` subsection appended under the `## Epics` heading of
`docs/specs/weave/engines/<entity>.md` (one consolidated file per engine — there is no per-epic
file or `epics/` directory).

Where NNN is zero-padded to 3 digits (001, 002, …). Determine the next number by scanning the
existing `### EPIC-` headings **within this file** and taking max + 1:

```bash
grep -oE '^### EPIC-[0-9]+' docs/specs/weave/engines/<entity>.md | sort | tail -1
```

If the file does not exist yet, create it with the engine `# <title>` heading + merged frontmatter
(`.claude/spec-templates/frontmatter-schema.md`) and a `## Epics` heading, then add this subsection.
Append your `### EPIC-NNN` without touching any other `##`/`###` section.

**Template:** `.claude/spec-templates/epic.md` (render its body as the subsection; the per-epic
metadata below becomes an italic metadata line under the `### EPIC-NNN` heading, not YAML
frontmatter — only the engine file carries frontmatter).

Never leave `{{PLACEHOLDER}}` in the output. All template variables must be resolved.

**Frontmatter:**

```yaml
---
type: Epic
title: "Epic: EPIC-NNN — <Epic Title>"
description: "<one-line summary of this epic's system capability>"
tags: [<entity>, 02-prd, epic]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: Backlog
priority: Must Have | Should Have | Could Have
entity: <entity>
phase: <Phase N — Phase Name>
prd_ref: "../prd.md#<anchor>"
resource: docs/specs/weave/engines/<entity>.md
---
```

**Footer line** (replace template default):

```
*Generated by Weave PO skill (po-epic).*
```

## Evaluation Criteria

A well-produced epic file:

- Has a Description that names a concrete system capability and states the consequence of
  deferring this epic — not a generic goal statement
- Has ≥ 3 epic-level ACs, all in EARS notation (`WHEN … THE SYSTEM SHALL …`), each
  capable of failing independently of story-level ACs
- Has no tautological ACs ("all stories complete", "feature works correctly")
- Has a User Stories table where every title is meaningful without additional context
- References Weave-stack specifics (Oxigraph, SPARQL, pytest, Playwright, CloudWatch,
  LocalStack) in ACs and Technical Notes where applicable
- Has no `{{PLACEHOLDER}}` text in the output file
- Was delivered section-by-section with HITL at every section
- Story list was confirmed by user before the table was written (Step 2 gate)
- Constitutional self-check trace present in chat for every section
- Committed with a conventional commit message (`docs(<entity>): add EPIC-NNN <slug>`)
