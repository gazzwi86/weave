# Five Whys

Iteratively ask "why?" to drill from a surface-level problem to its root cause. Avoids solution-first thinking by understanding the real need behind a requirement.

## Trigger

- User runs `/five-whys`
- Called by the Product Owner agent when the root problem behind a requirement is unclear
- Arguments: none (interactive problem definition), or a problem string to start directly

## Instructions

### Step 1: Define the Problem

If no starting statement provided, ask via AskUserQuestion:
- "What's the problem or requirement we're exploring?"

### Step 2: Iterate the Whys

For each "why" (up to 5, but can stop earlier if root cause is clearly found):

1. Present the current statement
2. Ask "Why?" via AskUserQuestion with options:
   - 3-4 possible reasons (agent-suggested based on context and domain knowledge)
   - Option for the user to provide their own answer
3. Take the answer and repeat

**Display format (build incrementally):**

```
Problem: {starting statement}

Why #1: Why {rephrased as question}?
-> Answer: {selected or provided answer}

Why #2: Why {rephrased from previous answer}?
-> Answer: {selected or provided answer}

Why #3: Why {rephrased from previous answer}?
-> Answer: {selected or provided answer}

...

ROOT CAUSE: {clearly stated root cause}
```

After each "why", check whether the root cause has been reached. Indicators:
- The answer points to a fundamental assumption, process, or constraint
- Going deeper would not yield actionable insight
- The user confirms this is the root

### Step 3: Identify Root Cause and Action

When root cause is identified:
1. State the root cause clearly in one sentence
2. Suggest 2-3 actionable next steps
3. Ask via AskUserQuestion whether this should be captured as:
   - A constraint (limitation to design around)
   - A requirement (something to build)
   - A decision (choice to document)

### Step 4: Capture Output

Write the full analysis to the appropriate location:
- If during PO elicitation: fold the root cause into the relevant spec section (brief constraints, PRD requirements, or roadmap risks)
- If standalone: create `docs/specs/decisions/FIVE-WHYS-{topic-slug}.md`

### Output Format

```markdown
# Five Whys Analysis: {Topic}

## Problem Statement
{original problem}

## Analysis

### Why #1: {question}
{answer}

### Why #2: {question}
{answer}

...

## Root Cause
{clearly stated root cause}

## Recommended Actions
1. {action}
2. {action}
3. {action}

## Captured As
{constraint / requirement / decision} -- folded into {spec file}
```

## Evaluation Criteria

When testing this skill, verify:

- **Reaches root cause**: The analysis drills past surface symptoms to a fundamental cause; does not stop at the first "why"
- **Output captured**: Full analysis is saved to `docs/specs/decisions/` (standalone) or folded into the relevant spec (during elicitation)
- **MCQ options provided**: Each "why" round offers 3-4 agent-suggested reasons plus a custom option via AskUserQuestion
- **Progressive depth**: Each successive "why" goes deeper than the previous; answers do not circle back or repeat
- **Early stop when appropriate**: Analysis stops before 5 if the root cause is clearly reached; does not force unnecessary rounds
- **Actionable output**: Root cause leads to specific, concrete next steps (not vague advice)
- **User participates at every level**: The agent does not answer its own "why" questions; user selects or provides each answer
- **Chain is coherent**: Each "why" logically follows from the previous answer; no jumps or non-sequiturs
