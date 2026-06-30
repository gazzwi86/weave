# UI Run-book — {{FEATURE_NAME}} ({{EPIC_ID}})

> The agent SCAFFOLDS this run-book (steps, expected states from the acceptance criteria, the nav
> path). A **human** opens the branch, performs each step, fills the **Observed** column, and signs
> `vouched-by`. An unsigned run-book does NOT pass `ui_verify` step E. AI-authored "expected"
> text is not evidence of human review — the human's observation is. (Council: anti-slop seat.)

**Branch:** `{{BRANCH}}`
**How to run locally:** `{{RUN_COMMAND}}`  → open `{{URL}}`
**Playwright trace (supporting evidence):** `{{TRACE_PATH}}`

## Scenario steps

| # | Action | Expected (from ACs) | Observed (human fills) | Pass? |
|---|--------|---------------------|------------------------|-------|
| 1 | {{STEP_1}} | {{EXPECTED_1}} | | ☐ |
| 2 | {{STEP_2}} | {{EXPECTED_2}} | | ☐ |
| 3 | {{STEP_3}} | {{EXPECTED_3}} | | ☐ |

## Cross-screen "links up" check
| Nav from → to | Expected to land on | Observed | Pass? |
|---|---|---|---|
| {{NAV_FROM}} → {{NAV_TO}} | {{NAV_EXPECTED}} | | ☐ |

## Sign-off
- All steps observed to pass: ☐
- Notes / deviations:
- **vouched-by:** {{HUMAN_NAME}} {{DATE}}
