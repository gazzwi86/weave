---
name: elicit
description: Structured elicitation for requirements gathering, decision-making, and knowledge extraction, consolidating Six Thinking Hats, Five Whys, Twenty Questions, and Stochastic Reasoning with method selection. Runs when the user runs /elicit or an agent detects conflicting requirements, unclear root cause, or competing approaches.
---

# Elicit

Structured elicitation skill for requirements gathering, decision-making, and knowledge extraction. Consolidates Six Thinking Hats, Five Whys, Twenty Questions, and Stochastic Reasoning into a single command with method selection.

## Trigger

- User runs `/elicit`
- PO agent suggests before document creation
- Architect agent suggests before spec generation
- Any agent detects: conflicting requirements, unclear root cause, broad scope, competing approaches

## Arguments

```
/elicit                              # No args: offer MCQ for target + method
/elicit brief                        # Elicit for a specific doc
/elicit brief:scope                  # Elicit for a specific section
/elicit --method six-hats "topic"    # Use specific method
/elicit --method five-whys "problem"
/elicit --method twenty-questions "area"
/elicit --method stochastic "decision"
```

## Instructions

### Step 0: Detect Current Spec State (never skip)

Before eliciting, know what already exists so you start fresh, fill gaps, or refine — never
duplicate a prior session. Run and read:

```bash
bash .claude/scripts/progress.sh kanban    # current project/phase + task board
```

Then, for the target entity, list what is on disk:

```bash
ls -1 docs/specs/weave/engines/<entity>.md 2>/dev/null      # which cascade sections exist (Brief, PRD, Epics, Roadmap)
ls -1 docs/specs/weave/engines/<entity>.md00-elicit/ 2>/dev/null   # prior elicitation output
```

Classify the situation and state it in one line before asking anything:

| Found | Mode | Behaviour |
|---|---|---|
| No `docs/specs/weave/engines/<entity>.md` | **Fresh** | Full elicitation from scratch |
| `00-elicit/` has prior output | **Refine** | Read it first; elicit only the gaps it left open — do not re-ask answered questions |
| `01-brief/` (or later) exists | **Gap-fill** | Target elicitation at the weakest/undecided sections of the existing artifact |

If a prior elicitation file already covers the requested topic, tell the user and offer to
extend it rather than starting a new session.

### Step 1: Determine Target and Method

If no arguments provided, ask via AskUserQuestion:

**Question 1: What is this elicitation for?**
- General — build understanding and detail
- Brief — mission, scope, success criteria
- PRD — requirements, user stories
- Epics — work breakdown, priorities
- Tasks — implementation detail
- Architecture — tech spec sections
- Specific section — (ask which doc:section)

**Question 2: Which technique?**
- Six Thinking Hats — explore from 6 perspectives (conflicting requirements, risk analysis)
- Five Whys — drill to root cause (unclear problem, surface symptoms)
- Twenty Questions — narrow broad scope (large undefined problem space)
- Stochastic Reasoning — weighted decision evaluation (competing approaches)
- General MCQ — structured multiple-choice questioning rounds

### Step 2: Context Detection

If the PO or Architect agent invokes this skill, detect the best method:

| Situation | Suggested Method |
|-----------|-----------------|
| Conflicting requirements | Six Thinking Hats |
| Unclear root problem | Five Whys |
| Broad undefined scope | Twenty Questions |
| Multiple valid approaches | Stochastic Reasoning |
| General detail needed | General MCQ |

Offer the suggested method via AskUserQuestion but let the user pick another.

### Step 3: Run Selected Method

Each method has its own instructions in supporting files:
- [Six Thinking Hats](methods/six-hats.md) — 6 perspectives in sequence with user input per hat
- [Five Whys](methods/five-whys.md) — iterative root cause analysis with MCQ options
- [Twenty Questions](methods/twenty-questions.md) — progressive narrowing with progress tracking
- [Stochastic Reasoning](methods/stochastic-reasoning.md) — weighted criteria matrix with scores

For **General MCQ**: Run structured multiple-choice questioning in batches of 4 (AskUserQuestion limit). Summarize after each round. Identify gaps and deep-dive.

### Step 4: Capture Output

- If during PO/Architect flow: fold findings into the relevant spec section
- If standalone: create `docs/specs/weave/engines/<entity>.md00-elicit/{METHOD}-{topic-slug}.md`
- Always summarize key findings and next steps

**OKF frontmatter is mandatory on any standalone `00-elicit/*.md` file** (it lands in the
`docs/` bundle; a missing `type` is a hard `/okf-validate` error). This requirement governs
the standalone outputs named in every method file (`SIX-HATS-*`, `FIVE-WHYS-*`, `20Q-*`,
`STOCHASTIC-*`). Write:

```yaml
---
type: Elicitation
title: "<Method>: <topic> — <entity display name>"
description: "<one-line summary of what this elicitation session resolved>"
tags: [<entity>, 00-elicit, <method-slug>]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
resource: docs/specs/weave/engines/<entity>.md00-elicit/<METHOD>-<topic-slug>.md
---
```

## Evaluation Criteria

- Correct method selected for the situation
- Method-specific instructions followed completely
- Output captured to spec files (not lost)
- User has choice of method (not forced)
- Context detection suggests appropriate method
- Works both standalone and when invoked by other agents
- All 4 methods + general MCQ are accessible
