---
description: Display a kanban-style progress dashboard showing current project status.
---

# /status

Display a kanban-style progress dashboard showing current project status.

## Instructions

When the user runs `/status`, read `.claude/state/progress.json` and display the current state.

### Step 1: Read State

Read `.claude/state/progress.json`. If it doesn't exist, tell the user to run `/init` first.

### Step 2: Display Kanban Board

Format tasks into a kanban board:

```
Project: {{project name}}
Phase: {{current phase}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Backlog       │ In Progress  │ Review       │ Done
──────────────┼──────────────┼──────────────┼──────────────
TASK-003      │ TASK-002     │ TASK-001     │ TASK-000
  Story title │   Story title│   Story title│   Story title
TASK-004      │              │              │
  Story title │              │              │

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Epics: 1/3 complete | Tasks: 2/8 complete | Coverage: 85%
```

### Step 3: Show Spec Status

Also show which spec artifacts exist and their approval status:

```
Spec Artifacts:
  Brief:            ✓ Approved
  PRD:              ✓ Approved
  Roadmap:          ◐ In Review
  Architecture:     ○ Not Started
  OpenAPI:          ○ Not Started
  Data Model:       ○ Not Started
  Testing Strategy: ○ Not Started
  DoR/DoD:          ○ Not Started
```

### Step 4: Show Next Action

Suggest the logical next step based on current state:
- No specs? → "Run `/po` to start requirements elicitation"
- Specs but no tasks? → "Run `/architect` to generate tech spec and tasks"
- Tasks ready? → "Run `/implement` to start the implementation loop"
- All done? → "All tasks complete. Consider running `/qa` for final review"
