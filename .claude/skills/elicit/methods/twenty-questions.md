# Twenty Questions

Use structured yes/no and multiple-choice questioning to progressively narrow a broad topic into specific, actionable requirements. Particularly useful early in elicitation when the problem space is large and undefined.

## Trigger

- User runs `/twenty-questions`
- Called by the Product Owner agent when the scope is broad and undefined
- Arguments: none (interactive topic selection), or a topic string to start directly

## Instructions

### Step 1: Set the Topic

If no topic provided, ask via AskUserQuestion:
- "What broad area should we narrow down with 20 Questions?"

### Step 2: Run Question Rounds

Ask questions in batches of 4 (AskUserQuestion limit), tracking progress throughout.

**Questioning strategy:**
- Start broad: "Is this about X or Y?" (halving the problem space)
- Progressively narrow: each question should eliminate possibilities
- Mix binary (yes/no) with multiple-choice where useful
- Track what has been established vs what is still open
- Adapt questions based on previous answers -- do not use a fixed script

**Display progress after each round:**

```
20 Questions: Round {N} (questions {start}-{end} of 20)

Established so far:
- {fact 1}
- {fact 2}
- {fact 3}

Still exploring:
- {open area 1}
- {open area 2}
```

### Step 3: Synthesize

After 20 questions (or fewer if clarity is reached earlier):
1. Summarize all established facts
2. Identify the specific requirement or decision reached
3. Note any remaining ambiguity that needs further exploration

### Step 4: Capture Output

Write the synthesis to the appropriate location:
- If during PO elicitation: fold findings into the relevant spec section
- If standalone: create `docs/specs/<entity>/00-elicit/20Q-{topic-slug}.md`

### Output Format

```markdown
# 20 Questions Analysis: {Topic}

## Starting Scope
{original broad topic}

## Question Log

### Round 1 (Q1-Q4)
1. {question} -> {answer}
2. {question} -> {answer}
3. {question} -> {answer}
4. {question} -> {answer}

**Established:** {what we now know}

### Round 2 (Q5-Q8)
...

## Synthesis

### Established Facts
- {fact 1}
- {fact 2}
...

### Specific Requirement / Decision
{what was narrowed down to}

### Remaining Ambiguity
- {open item, if any}

## Captured As
Folded into {spec file} / Saved as decision record
```

## Evaluation Criteria

When testing this skill, verify:

- **Progressive narrowing works**: Each round of questions narrows the scope; later questions are more specific than earlier ones
- **Output captured**: Full analysis is saved to `docs/specs/<entity>/00-elicit/` (standalone) or folded into the relevant spec (during elicitation)
- **Adaptive questioning**: Questions adapt based on previous answers; no fixed script that ignores responses
- **Progress tracking displayed**: After each round, established facts and open areas are shown
- **Early completion supported**: Session ends before 20 questions if clarity is reached; does not force unnecessary rounds
- **Space-halving strategy**: Early questions effectively divide the problem space rather than exploring details prematurely
- **Binary and MCQ mixed**: Both yes/no and multiple-choice question types are used as appropriate
- **Synthesis is specific**: Final output identifies a concrete requirement or decision, not just a list of facts
- **No repeated questions**: Each question explores new ground; no redundant questioning
