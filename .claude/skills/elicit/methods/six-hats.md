# Six Thinking Hats

Facilitate a structured Six Thinking Hats session to explore a topic from multiple perspectives. Based on Edward de Bono's technique for parallel thinking.

## Trigger

- User runs `/six-hats`
- Called by the Product Owner agent when conflicting requirements or risk analysis is needed
- Arguments: none (interactive topic selection), or a topic string to start directly

## Instructions

### Step 1: Set the Topic

If no topic provided, ask via AskUserQuestion:
- "What topic or decision should we explore with Six Hats?"

### Step 2: Run Each Hat

For each hat, present the perspective and gather input via AskUserQuestion. Summarize findings from each hat before moving to the next.

#### White Hat (Facts)
"What do we know? What data do we have? What information is missing?"
- Present known facts from existing specs (if available in `docs/specs/`)
- Ask what additional data the user has
- Identify information gaps

#### Red Hat (Feelings)
"What's your gut reaction? What feels right or wrong about this?"
- Ask for intuitive responses; no justification needed
- Capture emotional reactions and instincts

#### Black Hat (Caution)
"What could go wrong? What are the risks and weaknesses?"
- Identify risks, failure modes, edge cases
- Challenge assumptions
- Consider worst-case scenarios

#### Yellow Hat (Optimism)
"What's the best case? What are the benefits and opportunities?"
- Identify value, advantages, positive outcomes
- Consider best-case scenarios
- Highlight opportunities

#### Green Hat (Creativity)
"What alternatives exist? What new ideas come to mind?"
- Brainstorm alternatives, modifications, novel approaches
- No judgement during this phase
- Encourage unconventional thinking

#### Blue Hat (Process)
"What have we learned? What's the conclusion and next step?"
- Synthesize insights from all previous hats
- Identify key decisions or actions
- Determine concrete next steps

### Step 3: Capture Output

Write a summary to the appropriate location:
- If during PO elicitation: fold insights into the PRD, brief, or relevant spec section
- If standalone: create `docs/specs/decisions/SIX-HATS-{topic-slug}.md` with the full session output organized by hat

### Output Format

```markdown
# Six Hats Analysis: {Topic}

## White Hat (Facts)
{findings}

## Red Hat (Feelings)
{findings}

## Black Hat (Caution)
{findings}

## Yellow Hat (Optimism)
{findings}

## Green Hat (Creativity)
{findings}

## Blue Hat (Process / Conclusion)
{synthesis and next steps}
```

## Evaluation Criteria

When testing this skill, verify:

- **All 6 hats covered**: Every hat (White, Red, Black, Yellow, Green, Blue) is explored; none are skipped
- **Correct hat order**: Hats are presented in the standard sequence (White -> Red -> Black -> Yellow -> Green -> Blue)
- **Output captured to specs**: Session results are saved to `docs/specs/decisions/` (standalone) or folded into relevant spec (during elicitation)
- **Each hat gets user input**: AskUserQuestion is used for each hat; the agent does not answer all hats without user participation
- **Blue hat synthesizes**: The Blue Hat section contains a genuine synthesis of all previous hats, not just a summary
- **Facts separated from opinions**: White Hat captures only facts and data; opinions and feelings are in Red Hat
- **Risks are specific**: Black Hat identifies concrete risks, not generic warnings
- **Creativity is unconstrained**: Green Hat does not prematurely reject ideas
