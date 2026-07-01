---
name: po-roadmap
description: Produce a phase-structured delivery roadmap (roadmap.md) for a Weave spec entity, grouping approved epics into sequenced phases with explicit HITL gate criteria. Invoked by the product-owner agent after the PRD is approved; output feeds the architect tech-spec phase.
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
> `docs/specs/weave/engines/<entity>/04-arch/{tech-spec,tasks,decisions}/`.

# PO Roadmap Skill

Produce a phase-structured delivery roadmap (`roadmap.md`) for a Weave spec entity, grouping
PO-approved epics into sequenced phases with explicit HITL gate criteria at every phase
boundary. Invoked after the PRD is approved; output feeds the Architect's tech-spec phase.

## Model

- **Primary model:** claude-sonnet-5 (all phases — Gantt generation, phase block drafting,
  gate criteria prose)
- **Reasoning tier note:** Phase-scoping step (Step 2) requires dependency analysis; use
  extended thinking tokens via claude-sonnet-5's thinking budget rather than switching
  models. Do not invoke claude-opus-4-8 unless the user explicitly requests it.

## Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave product context, confirmed stack, laws, EARS notation rules
2. `.claude/spec-templates/roadmap.md` — section structure (use as scaffold, never leave `{{}}` in output)
3. `.claude/spec-templates/phase-gate.md` — gate checklist structure; gate exit criteria must mirror this
4. `docs/specs/weave/engines/<entity>.md` — success criteria and constraints
5. `docs/specs/weave/engines/<entity>.md` — approved epics and their priorities

Ask the user which entity this roadmap is for (e.g. `constitution-engine`, `build-engine`,
`weave-platform`) if not supplied. Output path is:
`docs/specs/weave/engines/<entity>.md`

## Instructions

### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs a roadmap before writing anything else.

Example: "A roadmap's job is to make phase boundaries undeniable. If a stakeholder cannot tell
you exactly what 'done with Phase 1' means — and what will stop the team from starting Phase 2
— the roadmap has failed. Every gate criterion should be binary: the system either satisfies it
or it does not."

Reference this principle when justifying phase boundaries and gate criteria during the HITL loop.

### Step 1 — Context ingestion

1. Read the approved PRD and extract all named epics with their MoSCoW priority.
2. Read the brief's success criteria and constraints.
3. Summarise what you know in 4 bullets before asking the first question:
   - Entity name and brief summary of what is being built
   - Total number of epics identified from the PRD
   - Any hard dependencies between epics (cannot start B before A)
   - Any hard timeline or resource constraints from the brief

### Step 2 — Phase scoping (AskUserQuestion — required before drafting)

Ask the user the following three questions in a single AskUserQuestion call:

1. "How many phases do you expect this delivery to have?"
   Options: 2 phases / 3 phases / 4+ phases / Not sure — suggest one
2. "What does each phase deliver at a high level? (Describe in 1 sentence per phase)"
   (free text — capture verbatim for use in Phase Goal sections)
3. "Who is the HITL gate approver for each phase boundary?"
   Options: Product Owner / Engineering Lead / Both / External Stakeholder

If the user selects "Not sure — suggest one", derive a phase grouping from the PRD epics using
this heuristic:

- **Phase 1:** Foundation — Must Have epics that have no predecessors (can start immediately)
- **Phase 2:** Core — remaining Must Have epics, plus Should Have epics that depend on Phase 1
- **Phase 3+:** Enhancement — Could Have epics and Should Have epics not needed for MVP

Propose this grouping with a rationale and ask for confirmation before proceeding.

### Step 3 — Section-by-section production

Produce the roadmap in this exact order. For each section:

1. **Write** the section to the file
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated
3. **Present** the section to the user (display the written content)
4. **Emit a confidence block** (see below) immediately before the HITL question
5. **Ask** via AskUserQuestion: Approve / Amend / Reject
6. If Amend: apply changes, show diff, re-present with updated confidence block
7. If Reject: regenerate with a cleaner approach, show the new version

**Sections in order:**

#### Overview + Gantt Diagram

Produce a Mermaid `gantt` diagram that:

- Uses `dateFormat YYYY-MM-DD` with realistic relative durations (estimate from epic count;
  default 2 weeks per epic unless the user has specified otherwise)
- Has one `section` per phase
- Lists every epic as a task bar within its phase section
- Inserts a `milestone` row labelled `HITL Gate N` at the END of each phase section, with
  duration `0d` (milestone point, not a bar)
- Uses `after <prior-task>` chaining so the diagram reflects sequential dependencies

Below the Gantt, write the Overview metadata block:

```markdown
**Entity:** <entity name>
**Brief:** [brief.md](../01-brief/brief.md)
**PRD:** [prd.md](../02-prd/prd.md)
**Status:** Draft
**Phases:** <N>
**HITL Gates:** <N>
```

After presenting the Gantt, ask via AskUserQuestion:
"Does this phase grouping reflect your delivery intent?"
Options: Yes, proceed / Adjust phase boundaries / Adjust timeline / Regenerate from scratch

Do not proceed to Phase 1 until the user approves the Gantt.

#### Phase 1 Definition

Produce a full phase block using this structure:

```markdown
### Phase 1: <phase name>

**Goal:** <Single sentence. What is delivered and verifiable at gate close.>
**Duration:** <Estimated calendar weeks>
**HITL Gate:** Gate 1 — <1-sentence gate description>

| Epic ID | Epic Title | Description | Stories (est.) | Priority |
|---------|------------|-------------|----------------|----------|
| EPIC-001 | <title> | <2-sentence description> | <N> | Must Have |

**Entry Criteria (Definition of Ready):**
- [ ] PRD approved and signed off
- [ ] Tech spec approved for Phase 1 epics
- [ ] Tasks decomposed, estimated, and reviewed by Engineering Lead
- [ ] <Any phase-specific prerequisite>

**Exit Criteria (HITL Gate 1):**
- [ ] WHEN all Phase 1 epics are marked Done THE SYSTEM SHALL have 0 open blocking bugs
- [ ] WHEN the gate review runs THE SYSTEM SHALL pass all unit, integration, and E2E tests
- [ ] WHEN coverage is measured THE SYSTEM SHALL report >= 80% line coverage and >= 70% mutation score
- [ ] <Phase-specific observable outcome in EARS notation>
- [ ] Human approver has reviewed and signed off the gate checklist

**phase_gate() metadata:**
phase: 1
gate_id: gate-1
condition: all_exit_criteria_met
approver: <role from Step 2>
blocks: phase-2
```

Rules for Exit Criteria:
- Every criterion MUST use EARS notation: `WHEN [trigger] THE SYSTEM SHALL [behaviour]`
- At least one criterion must reference a concrete, measurable artefact (test pass rate,
  coverage %, a live URL, a deployed API endpoint)
- The final criterion must always be the human sign-off line

The `phase_gate()` metadata block is YAML-in-a-code-fence. It drives the dark factory
`phase_gate()` check during implementation. Never omit it.

#### Phase 2+ Definitions (one AskUserQuestion loop per phase)

For each additional phase (Phase 2, Phase 3, etc.), repeat the Phase 1 structure with:

- `**Dependencies:** Phase N-1 gate passed` added below the Goal line
- Entry Criteria updated to reference the prior phase gate
- Phase-specific epics from the PRD epic list

Gate granularity rule: one HITL AskUserQuestion per phase block. Do NOT ask for approval
after each epic row — only after the complete phase block is written.

If the user has 4+ phases, offer to batch Phase 3 and Phase 4 drafts together for
efficiency, but still present them separately for approval (one AskUserQuestion per phase).

#### HITL Gate Summary Table

Produce a summary table of all gates:

```markdown
## HITL Gate Summary

| Gate | After Phase | Gate Description | Exit Criterion (key) | Approver | blocks |
|------|-------------|-----------------|----------------------|----------|--------|
| Gate 1 | Phase 1 | <1-line> | <primary EARS criterion> | <role> | Phase 2 |
| Gate 2 | Phase 2 | <1-line> | <primary EARS criterion> | <role> | Phase 3 |
```

Rules:
- "Exit Criterion (key)" must be the single most important EARS criterion from that gate
- "blocks" must reference the next phase by name (or "Release" for the final gate)
- Every gate must have a named approver role

### Add a `# Related` section (build the knowledge-graph edges)

Append a `# Related` section linking predecessor and successor documents with `docs/`-relative
or path-relative markdown links. **Link only files that exist on disk now.**
- Predecessor (always exists): the PRD — `[prd.md](../02-prd/prd.md)` — and the brief.
- Do **not** forward-link tech-spec shards (`../04-arch/tech-spec/*.md`) until they exist; the
  architect skills add the back-link to this roadmap when they run.

### After all sections approved

Commit the roadmap:

```bash
git add docs/specs/weave/engines/<entity>.md
git commit -m "docs(<entity>): add delivery roadmap with <N> phases and HITL gates"
```

Then tell the user: "Roadmap complete. HITL gate exit criteria serve two roles in
implementation: they become the `phase_gate()` conditions checked by the dark factory at phase
close, and they are the `/goal` primitive conditions that the `/implement` loop verifies before
marking a phase done. Next step: `/architect` produces the tech spec scoped to Phase 1 epics."

## Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
Roadmap Law 1 (phase boundary clarity): complied | violated | N/A — <reason>
Roadmap Law 2 (EARS exit criteria): complied | violated | N/A — <reason>
Roadmap Law 3 (phase_gate metadata present): complied | violated | N/A — <reason>
Roadmap Law 4 (Gantt approved before phases): complied | violated | N/A — <reason>
Roadmap Law 5 (gate per phase not per epic): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

**Roadmap Law definitions:**

- **Roadmap Law 1 (phase boundary clarity):** Every phase has a single-sentence Goal and a
  named gate that makes the boundary unambiguous.
- **Roadmap Law 2 (EARS exit criteria):** Every exit criterion uses `WHEN … THE SYSTEM SHALL …`
  notation. Plain-language criteria are a violation.
- **Roadmap Law 3 (phase_gate metadata present):** Every phase block includes a `phase_gate()`
  YAML metadata fence. Missing metadata = violation.
- **Roadmap Law 4 (Gantt approved before phases):** The Gantt diagram must be approved by the
  user (via AskUserQuestion) before any phase block is drafted.
- **Roadmap Law 5 (gate per phase not per epic):** HITL AskUserQuestion is issued once per
  complete phase block, not per epic row within a phase.

## Confidence block (emit before every HITL question)

Output this block immediately after presenting the section, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific bullet, sentence, or table row>
Why: <1 sentence — what input was missing or what you assumed>
</section-confidence>
```

Rules:

- Always name the weakest part, even on high-confidence sections.
- "Why" must reference a specific input gap or assumption. "The future is uncertain" is not
  acceptable.
- For phase duration estimates, the weakest part is almost always the story-count assumption —
  name it explicitly.
- The block lives in chat only — do not embed it in the roadmap file.

## Output

File: `docs/specs/weave/engines/<entity>.md`
Template: `.claude/spec-templates/roadmap.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.

Frontmatter:

```yaml
---
type: Roadmap
title: "Roadmap: <entity display name>"
description: "<one-line summary of the phased delivery roadmap for this entity>"
tags: [<entity>, 03-roadmap]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: Draft
phases: <N>
gates: <N>
resource: docs/specs/weave/engines/<entity>.md
---
```

The frontmatter `phases` and `gates` counts are consumed by `.claude/scripts/progress.sh`
to track roadmap completeness in `.claude/state/progress.json`.

## Evaluation Criteria

A well-produced roadmap:

- Has a Mermaid Gantt with every epic as a named task bar and every gate as a `milestone` row
- Every phase has a single-sentence Goal that is falsifiable (a stakeholder can verify it)
- Every exit criterion uses EARS notation (`WHEN … THE SYSTEM SHALL …`)
- Every phase block includes a `phase_gate()` YAML metadata fence with `condition`,
  `approver`, and `blocks` keys
- The HITL Gate Summary table lists every gate with a named approver role and the next phase
  it blocks
- Gantt was presented and approved via AskUserQuestion before any phase block was drafted
- No `{{PLACEHOLDER}}` text remains in the output file
- Constitutional self-check trace present in chat for every section
