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
- If standalone: create `docs/specs/decisions/{METHOD}-{topic-slug}.md`
- Always summarize key findings and next steps

## Evaluation Criteria

- Correct method selected for the situation
- Method-specific instructions followed completely
- Output captured to spec files (not lost)
- User has choice of method (not forced)
- Context detection suggests appropriate method
- Works both standalone and when invoked by other agents
- All 4 methods + general MCQ are accessible
