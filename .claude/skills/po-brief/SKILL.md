---
name: po-brief
description: Produce a high-quality project brief (brief.md) for a Weave spec entity, one section at a time with HITL. Invoked by the product-owner agent as the first PO artifact.
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

# PO Brief Skill

Produce a high-quality project brief (`brief.md`) for a Weave spec entity. One section at
a time, with HITL review at every section. Opus for elicitation; Sonnet for drafting.

## Model

- **Elicitation phase:** claude-opus-4-8 (wide reasoning, novel framing, root-cause probing)
- **Drafting phase:** claude-sonnet-4-6 (structured, precise prose)

## Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave product context, confirmed stack, laws
2. `.claude/spec-templates/brief.md` — section structure (use as scaffold, never leave `{{}}` in output)
3. Any prior elicitation output (`docs/specs/weave/engines/<entity>.md00-elicit/*.md` if present)
4. Any existing brief draft (`docs/specs/weave/engines/<entity>.md` if present) to continue or refine

Ask the user which entity this brief is for (e.g. `constitution-engine`, `build-engine`,
`weave-platform`) if not supplied. Output path is:
`docs/specs/weave/engines/<entity>.md`

## Instructions

### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs a brief before writing anything else.

Example: "A brief's job is to commit to a single falsifiable outcome. If a stakeholder reads
it and still has to guess what 'done' means, the brief has failed. Every section should add
a constraint that rules something out."

Reference this principle when justifying decisions during the HITL loop.

### Step 1 — Context ingestion

1. Read existing specs (listed in Input above)
2. Read `CLAUDE.md` for Weave product positioning and laws
3. Summarise what you know in 3 bullets before asking the first question:
   - What the entity is (from Weave's sub-system list)
   - What is already decided (from CLAUDE.md § Architecture decisions)
   - What is not yet decided (scope, success criteria, constraints)

Ask via AskUserQuestion:
- "What context do you have?" Options: Meeting notes / Verbal description / Existing draft to refine / Start from scratch

4. Before creating the brief, offer structured elicitation via AskUserQuestion:
   "Run a structured elicitation first?" Options: 20 Questions / Six Hats / Five Whys / Skip

### Step 2 — Research round

Use WebSearch to find:
- Comparable products in the same domain (no more than 2-3 queries)
- Industry-standard success criteria for this type of product
- Known failure modes or constraints in this problem space

Record findings as concise bullets. Reference them when writing the Success Criteria and
Constraints sections.

### Step 3 — Section-by-section production

Produce the brief in this exact order. For each section:
1. **Write** the section to the file
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated
3. **Present** the section to the user (display the written content)
4. **Emit a confidence block** (see below) immediately before the HITL question
5. **Ask** via AskUserQuestion: Approve / Amend / Reject
6. If Amend: apply changes, show diff, re-present with updated confidence block
7. If Reject: regenerate with a cleaner approach, show the new version

**Sections in order:**

#### Mission Statement
One sentence: what we're building, for whom, and why it matters. Must be falsifiable.
Good: "We are building X for Y so that Z, replacing the current W that costs Q."
Bad: "We are building a developer productivity tool."

EARS notation does not apply here (prose, not AC). But the statement must be testable at
a macro level (can a stakeholder verify it 12 months from now?).

#### Problem
What problem does this solve? Who has it? What happens if we don't solve it?
Must name: the current-state pain, the persona experiencing it, the consequence of inaction.

#### Vision
What does success look like? 3-5 bullet outcomes, each observable within 12 months.
Cite research findings (Step 2) where relevant.

#### Scope
In Scope (bulleted) and Out of Scope (bulleted). Out of Scope is as important as In Scope —
it rules out scope creep before it starts.

#### Target Users

Table: User Type | Description | Primary Need
3-5 rows max. Deliver in batches of 3 if > 3 rows (AskUserQuestion after each batch).

#### Success Criteria
Bulleted checklist items. Each must be:
- Measurable (has a number or a binary signal)
- Time-bounded (has a target date or milestone)
- Sourced (who measures it, from what system)

Example: `- [ ] 80% of Constitution Engine specs complete within 1 session of /po (measured via session transcript analysis, target: 30 days post-launch)`

#### Constraints
Technical, business, and timeline constraints. Reference confirmed stack decisions from
`CLAUDE.md` where relevant (e.g. "AWS-only cloud; no multi-cloud in v1").

#### Key Decisions

Table: Decision | Rationale | Date
List confirmed architectural/product decisions relevant to this entity.
Link to `CLAUDE.md § Architecture decisions (confirmed)` for the master list.

### Machine-Readability Checklist (run before finalising — blocking)

A brief is the root contract the entire dark factory inherits. Agents are gap-intolerant:
any ambiguity here is bridged downstream by hallucination, not judgement. Before committing,
walk this checklist out loud in chat and resolve every `✗` with the user before proceeding.
The completeness test (AERO): *"Could a downstream agent, given only this brief, derive a
PRD and tasks without inventing scope, naming, or success conditions?"*

```
[ ] Acceptance criteria — every Success Criterion is measurable (number or binary signal),
    time-bounded (date or milestone), and sourced (who measures it, from what system)
[ ] Success metric — at least one falsifiable top-line metric a stakeholder can verify in 12 months
[ ] Entity boundary — Scope names what is IN and what is OUT; no capability is left undecided
[ ] Explicit non-goals — Out-of-Scope rules out the known scope-creep vectors for this entity
[ ] Testable completion — "done" is stated as an observable condition, not an aspiration
[ ] Stakeholder identified — Target Users names concrete personas (never "user"), each with a Primary Need
[ ] Stack alignment — Constraints reference the confirmed Weave stack where relevant (no re-litigation)
[ ] No placeholders — zero `{{...}}` or `<...>` tokens remain in the file
[ ] OKF frontmatter — `type: Product Brief` plus title/description/tags/timestamp present
```

If any item is `✗`, fix it (loop back to the relevant section's HITL) before committing.
Output the completed checklist in chat — it is the brief's machine-readability receipt.

### Add a `# Related` section (build the knowledge-graph edges)

Append a `# Related` section to the end of the brief that cross-links predecessor and
successor documents using `docs/`-relative or path-relative markdown links. This is how OKF
edges form between concepts.

**Discipline (do not break it):** link only files that **exist on disk right now**.
- Predecessors that may exist: prior elicitation (`../00-elicit/*.md`), the platform brief
  (`../../weave-platform/01-brief/brief.md`) for an engine entity.
- Do **not** emit a forward-link to `02-prd/prd.md` or any successor until it exists — an
  unresolved link becomes a broken OKF cross-link warning. The PRD skill adds the back-link
  to this brief when it is written.

### After all sections approved

Commit the brief:
```
git add docs/specs/weave/engines/<entity>.md
git commit -m "docs: add <entity> brief"
```

Then tell the user: "Brief complete. Next step: `/po` continues with the PRD, or run
`/po-prd` directly."

## Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
PO Law 1 (AskUserQuestion for decisions): complied | violated | N/A — <reason>
PO Law 2 (section-by-section delivery): complied | violated | N/A — <reason>
PO Law 3 (small batches for tables): complied | violated | N/A — <reason>
PO Law 4 (capture technical prerequisites): complied | violated | N/A — <reason>
PO Law 5 (offer /elicit before documents): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

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
- "Why" must reference a specific input gap. "The future is uncertain" is not acceptable.
- The block lives in chat only — do not embed it in the file.

## Output

File: `docs/specs/weave/engines/<entity>.md`
Template: `.claude/spec-templates/brief.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.
Frontmatter (OKF v0.1 — `type` is mandatory or the bundle fails `/okf-validate`):
```yaml
---
type: Product Brief
title: "Brief: <entity display name>"
description: "<one-line summary of what this entity delivers and for whom>"
tags: [<entity>, 01-brief]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: Draft
resource: docs/specs/weave/engines/<entity>.md
---
```

## Evaluation Criteria

A well-produced brief:
- Has a falsifiable, single-sentence Mission Statement
- Names the current-state pain and consequence of inaction in the Problem section
- Has ≥ 3 measurable, time-bounded success criteria
- Has explicit Out of Scope items that rule out known scope creep vectors
- References confirmed Weave stack decisions in Constraints
- Has no `{{PLACEHOLDER}}` text
- Was delivered section-by-section with HITL at every section
- Constitutional self-check trace present in chat for every section
