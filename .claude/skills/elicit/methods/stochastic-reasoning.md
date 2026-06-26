# Stochastic Reasoning

Evaluate competing approaches using fuzzy analytic hierarchy with weighted criteria and scored options. Useful when there is no clear "right answer" and multiple factors compete.

## Trigger

- User runs `/stochastic-reasoning`
- Called by the Product Owner or Architect agent when choosing between multiple valid approaches
- Arguments: none (interactive decision setup), or a decision string to start directly

## Instructions

### Step 1: Define the Decision

If no decision provided, ask via AskUserQuestion:
- "What decision are we evaluating? (e.g., 'Which state management approach?')"

### Step 2: Identify Options

Ask the user to confirm options via AskUserQuestion:
- Present 2-4 agent-suggested options based on context and domain knowledge
- Include an option for the user to add their own
- Aim for 2-5 total options to keep the matrix manageable

### Step 3: Define Criteria

Ask what matters via AskUserQuestion. Suggest relevant criteria based on the decision domain:
- e.g., Performance, Maintainability, Team familiarity, Time to implement, Scalability, Cost, Security, Community support
- User selects which criteria matter (multiSelect)
- Aim for 3-6 criteria to keep scoring tractable

### Step 4: Weight Criteria

For each selected criterion, ask relative importance via AskUserQuestion:
- "How important is {criterion}?"
- Options: Critical (5), Important (4), Moderate (3), Nice-to-have (2), Minor (1)

### Step 5: Score Options

For each option against each criterion, provide a fuzzy score (1-5):
- Agent scores based on available context, research, and domain knowledge
- Present the full score matrix for user review and adjustment
- User can override any score

### Step 6: Calculate and Present

Produce a weighted score matrix:

```
Decision: {decision title}

                    | Weight | Option A | Option B | Option C |
--------------------+--------+----------+----------+----------+
{Criterion 1}      |   {w}  |  {s}/5   |  {s}/5   |  {s}/5   |
{Criterion 2}      |   {w}  |  {s}/5   |  {s}/5   |  {s}/5   |
{Criterion 3}      |   {w}  |  {s}/5   |  {s}/5   |  {s}/5   |
--------------------+--------+----------+----------+----------+
Weighted Score      |        |  {total} |  {total} |  {total} |
Confidence          |        |  {level} |  {level} |  {level} |

Recommendation: {winner} (score: {N}, {confidence} confidence)
Runner-up: {second} (score: {N}, {confidence} confidence -- {key risk})
```

**Weighted score calculation:** For each option, sum (criterion weight * option score) across all criteria.

**Confidence level:** Based on score variance and how well-understood the option is:
- High: well-known option, consistent scores across criteria
- Medium: some uncertainty in scoring
- Low: significant unknowns

### Step 7: Capture Output

1. Ask user to confirm or override the recommendation via AskUserQuestion
2. Write the analysis to the appropriate location:
   - If during PO/Architect flow: fold into an ADR or relevant spec section
   - If standalone: create `.claude/specs/<entity>/00-elicit/STOCHASTIC-{topic-slug}.md`

### Output Format

```markdown
# Stochastic Reasoning: {Decision Title}

## Decision
{what is being decided}

## Options Evaluated
1. {Option A} -- {brief description}
2. {Option B} -- {brief description}
3. {Option C} -- {brief description}

## Criteria and Weights
| Criterion | Weight | Rationale |
|-----------|--------|-----------|
| {name}    | {1-5}  | {why this weight} |

## Score Matrix
{the weighted score table from Step 6}

## Recommendation
{winner} is recommended because {justification referencing top-scoring criteria}.

## Key Risks
- {risk of the recommended option}
- {what to watch for}

## Runner-up Analysis
{when the runner-up would be the better choice instead}

## Decision
Accepted / Overridden by user: {alternative chosen}
```

## Evaluation Criteria

When testing this skill, verify:

- **Weighted matrix correct**: Weighted scores are calculated correctly (sum of weight * score for each option)
- **Recommendation justified**: The recommendation references specific criteria scores to explain why it won, not just the total
- **All options scored**: Every option is scored against every criterion; no gaps in the matrix
- **User participates in weighting**: Criteria weights come from user input, not agent defaults
- **Score overrides supported**: User can adjust agent-proposed scores before final calculation
- **Confidence levels assigned**: Each option has a confidence level (High/Medium/Low) with reasoning
- **Output captured to specs**: Decision record is saved to `.claude/specs/<entity>/00-elicit/` or folded into an ADR
- **Runner-up analysis present**: Output explains when the second-place option would be preferable
- **Criteria are relevant**: Suggested criteria are appropriate for the decision domain, not generic
- **Matrix is readable**: The score table renders clearly with aligned columns
