---
name: arch-adr
description: Record a single architectural decision as a concise, durable ADR (ADR-NNN.md). Invoked by the architect agent when a technical choice needs capturing before it is forgotten or contested.
---

# Arch ADR Skill

Record a single architectural decision as a concise, durable ADR (Architecture Decision Record).
Invoked once per decision — called from `/architect`, `/implement`, or directly by the user
when a new technical choice needs to be captured before it is forgotten or contested.

## Model

- **Elicitation phase:** high tier (probing context, surfacing hidden alternatives)
- **Drafting phase:** mid tier (precise, opinionated prose)

ADRs are short documents. The full draft — all sections — is presented to the user in a
single HITL round. Elicitation is one targeted question before drafting begins.

## Input

Before doing anything else, read:

1. `CLAUDE.md` — confirmed Weave stack defaults (never document confirmed-stack decisions as ADRs;
   those already live in CLAUDE.md)
2. `.claude/spec-templates/adr.md` — exact section structure and in-file examples
3. Any existing ADRs in `docs/specs/weave/engines/<entity>/decisions/` to determine the next
   sequence number and avoid duplicating a decision already recorded
4. Any relevant tech-spec at `docs/specs/weave/engines/<entity>/tech-spec/architecture.md` for context

Ask the user which entity this ADR belongs to if not supplied. Valid entities include:
`constitution-engine`, `build-engine`, `events-actions-engine`, `graph-explorer`,
`weave-platform`.

## Instructions

### Step 0 — State the governing principle (never skip)

Before writing, state aloud (in chat) the governing principle for an ADR:

> "An ADR's job is to record a commitment the team can later challenge with evidence.
> It must name a specific technology or approach, explain the forces that shaped the choice,
> and name a re-evaluation trigger so the decision does not rot silently. A vague ADR is
> not an ADR — it is a rationalisation."

Reference this when justifying decisions during the HITL loop.

### Step 1 — Context ingestion

1. Read existing ADRs in `docs/specs/weave/engines/<entity>/decisions/` and determine `NNN`
   (zero-padded three digits: `001`, `002`, …). If the directory does not exist, `NNN = 001`.
2. Read `CLAUDE.md` to identify confirmed stack defaults. If the user's decision merely
   reaffirms a confirmed default (e.g. "use FastAPI"), stop and tell the user:
   > "This decision is already captured in CLAUDE.md as a confirmed default. No ADR needed
   > unless you are overriding or extending it. Should we proceed to document an override?"
3. Summarise in 2-3 bullets what you know:
   - Entity and affected sub-system
   - Relevant confirmed-stack constraints from CLAUDE.md
   - Any prior ADRs that touch the same concern

### Step 2 — Elicitation (single targeted question)

Ask via AskUserQuestion:

> "What is the decision context?"

Options: Component or layer (Backend / Frontend / Data / Infrastructure / AI Agents) /
Free-text description of the problem being solved

Accept the user's answer and proceed directly to drafting. Do NOT run multi-round
elicitation for ADRs — they are deliberately short documents.

### Step 3 — Draft all sections in one pass

Draft the full ADR in the correct order (see Sections below). Write to the output file.
Then run the constitutional self-check, present all sections at once, emit the confidence
block, and ask Approve / Amend / Reject in a single HITL round.

**ADRs are short enough to review in full. Do not split the HITL.**

#### Section order

##### Title and Status

- Title: imperative sentence naming the decision (e.g. "Use Oxigraph as the RDF store
  for development and test environments").
- Status: one of `Proposed` | `Accepted` | `Deprecated` | `Superseded by ADR-NNN`.
- New ADRs start as `Proposed`. The author changes to `Accepted` when the team agrees.

##### Context

What forces make this decision necessary? Include:
- The technical or product constraint driving the choice
- Any Weave-confirmed defaults that scope the option space (cite CLAUDE.md)
- The cost of deferring the decision
- One or two concrete examples of where the decision will be felt (file path, API call, etc.)

Keep to 3-6 sentences. This is not a tutorial — assume the reader knows the technology space.

Do NOT include a Mermaid diagram in this section (ADRs are prose records, not architecture
diagrams — use the tech-spec for diagrams). If a diagram genuinely aids understanding,
include it in the Consequences section and label it clearly.

##### Decision

One clear statement of what was decided. Format:

> We will **[specific technology / pattern / constraint]** for **[scope]** because **[key reason]**.

Follow with 2-4 supporting bullet points if the rationale cannot fit in the one-liner.
Be specific: name the library, the version strategy, the configuration pattern, or the
boundary. Vague decisions (e.g. "we will use modern best-practice technologies") are invalid —
the constitutional self-check will catch them.

##### Consequences

Three sub-sections: Positive, Negative, Neutral.

- **Positive:** what becomes easier, faster, or safer because of this decision.
- **Negative:** what becomes harder, slower, or more expensive. Include the real costs —
  do not minimise them. An honest Negative section is a sign of a trustworthy ADR.
- **Neutral:** side effects that are neither good nor bad but must be noted (e.g. "all
  new engineers must be onboarded to X").

Each sub-section: 2-4 bullets. If a sub-section has nothing to say, write a single bullet:
"— none identified."

Include a **Re-evaluation trigger** at the end of this section:

> **Re-evaluate when:** [specific, observable condition that would invalidate this decision].

Example: "Re-evaluate when: RDF query latency at 95th percentile exceeds 200ms under 10k
concurrent triples, or when a GA Neptune connector becomes available."

##### Alternatives Considered

One sub-section per alternative rejected. For each:

```
### [Alternative name]
- **Pros:** [genuine advantages — do not hand-wave]
- **Cons:** [genuine disadvantages]
- **Why rejected:** [specific reason tied to Weave's context, not generic opinion]
```

At least 2 alternatives must be listed. If the user cannot name alternatives, use the
elicitation answer to suggest plausible ones and ask the user to confirm or correct.
The template examples (in `adr.md`) show what good and bad rejection reasons look like.

### Step 4 — Constitutional self-check

Run before presenting the draft to the user. Write one line per Law, exactly as follows:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
ADR Law 1 (no confirmed-default duplication): complied | violated | N/A — <reason>
ADR Law 2 (decision is specific and names a technology/pattern): complied | violated | N/A — <reason>
ADR Law 3 (Negative consequences are honest — not minimised): complied | violated | N/A — <reason>
ADR Law 4 (re-evaluation trigger present): complied | violated | N/A — <reason>
ADR Law 5 (≥ 2 alternatives with genuine rejection reasons): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the relevant section, re-run the check.
Output the trace in chat (user sees it). This keeps Laws active across long sessions.

### Step 5 — Single HITL round

Present the full ADR in chat (all sections). Then emit the confidence block and ask once.

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific section or bullet>
Why: <1 sentence — what input was missing or assumed>
</section-confidence>
```

Rules:
- Always name the weakest part, even on high-confidence drafts.
- "Why" must reference a specific input gap — "the future is uncertain" is not acceptable.
- The block lives in chat only — do not embed it in the file.

Ask via AskUserQuestion: **Approve / Amend / Reject**

- If **Amend**: apply changes inline, show the diff in chat, re-run the self-check, emit
  an updated confidence block, and present the revised ADR. Then ask Approve / Reject
  (no further Amend loop — if the user still wants changes, treat as Reject and regenerate).
- If **Reject**: regenerate cleanly from Step 3. Ask the user one targeted question about
  what went wrong before regenerating so the second attempt is better.

### Step 6 — Commit

After approval:

```bash
git add docs/specs/weave/engines/<entity>/decisions/ADR-NNN.md
git commit -m "docs(<entity>): add ADR-NNN <decision title in lowercase>"
```

Example: `docs(constitution-engine): add ADR-001 use oxigraph as rdf store for dev-test`

Then tell the user:

> "ADR-NNN recorded. If this decision affects the tech-spec, update
> the relevant file in `docs/specs/weave/engines/<entity>/tech-spec/` to reference this ADR."

## Constitutional self-check (run before every delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
ADR Law 1 (no confirmed-default duplication): complied | violated | N/A — <reason>
ADR Law 2 (decision is specific and names a technology/pattern): complied | violated | N/A — <reason>
ADR Law 3 (Negative consequences are honest — not minimised): complied | violated | N/A — <reason>
ADR Law 4 (re-evaluation trigger present): complied | violated | N/A — <reason>
ADR Law 5 (≥ 2 alternatives with genuine rejection reasons): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise, re-check.

## Confidence block (emit before every HITL question)

Output this block immediately after presenting the ADR, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific section or bullet>
Why: <1 sentence — what input was missing or assumed>
</section-confidence>
```

Rules:
- Always name the weakest part, even on high-confidence drafts.
- "Why" must reference a specific input gap. "The future is uncertain" is not acceptable.
- The block lives in chat only — do not embed it in the file.

## Output

File: `docs/specs/weave/engines/<entity>/decisions/ADR-NNN.md`

Create the directory if it does not exist:

```bash
mkdir -p docs/specs/weave/engines/<entity>/decisions
```

Template: `.claude/spec-templates/adr.md`

Never leave `{{PLACEHOLDER}}` text in the output. The HTML comment block at the top of the
template (examples) must be stripped from the generated file.

Frontmatter:

```yaml
---
type: ADR
title: "ADR-NNN: <imperative title>"
description: "<one-line summary of the decision and its consequence>"
tags: [<entity>, arch, decision]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: Proposed
created: <YYYY-MM-DD>
entity: <entity>
deciders: <comma-separated names or "TBD">
---
```

Replace the footer line `*Generated by Weave Architect agent.*` with:

```
*Generated by Weave arch-adr skill.*
```

## Evaluation Criteria

A well-produced ADR:

- Has a specific, imperative title that names a technology or pattern (not "use best practices")
- Does not duplicate a decision already captured in `CLAUDE.md` as a confirmed default, unless
  explicitly documenting an override
- Has a Decision section that names a specific technology/library/pattern and the primary reason
- Has an honest Negative consequences sub-section with ≥ 1 real trade-off
- Has a re-evaluation trigger that is specific and observable (cites a metric or event, not
  "when things change")
- Has ≥ 2 alternatives with genuine pros/cons and rejection reasons tied to Weave's context
- Has no `{{PLACEHOLDER}}` text and no HTML comment blocks from the template
- Was delivered as a single HITL round (full ADR presented at once, not section-by-section)
- Constitutional self-check trace present in chat, all Laws complied or N/A
