---
name: status
description: Display a kanban-style progress dashboard showing current project status, spec artifact status, and the suggested next action. Invoked when the user runs /status or /implement status.
---

# Status

Display a kanban-style progress dashboard showing current project status, spec artifact status, and suggested next action.

## Trigger

- User runs `/status`
- Also available as `/implement status`
- No arguments

## Instructions

### Step 1: Read State

Read `.claude/state/progress.json`. If it does not exist, tell the user to run `/init` first.

### Step 2: Display Kanban Board

Format tasks into a kanban board:

```
Project: {project name}
Phase: {current phase}
------------------------------------------------------------

Backlog       | In Progress  | Review       | Done
--------------+--------------+--------------+--------------
TASK-003      | TASK-002     | TASK-001     | TASK-000
  Story title |   Story title|   Story title|   Story title
TASK-004      |              |              |
  Story title |              |              |

------------------------------------------------------------
Epics: 1/3 complete | Tasks: 2/8 complete | Coverage: 85%
```

Use `${CLAUDE_PLUGIN_ROOT}/scripts/progress.sh kanban` if available, otherwise render from progress.json directly.

### Step 3: Show Spec Artifact Status

Check which spec artifacts exist and their content status:

```
Spec Artifacts:
  Brief:            [Approved / In Review / Not Started]
  PRD:              [Approved / In Review / Not Started]
  Roadmap:          [Approved / In Review / Not Started]
  Architecture:     [Approved / In Review / Not Started]
  OpenAPI:          [Approved / In Review / Not Started]
  Data Model:       [Approved / In Review / Not Started]
  Testing Strategy: [Approved / In Review / Not Started]
  DoR/DoD:          [Approved / In Review / Not Started]
```

Determine status by:
- File does not exist or is template-only -> Not Started
- File has content but no approval marker -> In Review
- File has approval marker or is referenced by tasks -> Approved

### Step 3b: Spec Health

Give instant visibility into spec completeness before `/implement` is ever run. Two parts:

**Per-entity map.** For each engine spec `docs/specs/weave/engines/<entity>.md`, report which
cascade phases are present (now **sections**, not directories) and which phase the entity is in.
Brief/PRD/Epics/Roadmap are `##`/`###` sections in that file; the architect artifacts are files
under the sibling `docs/specs/weave/engines/<entity>/` directory — `tech-spec/` and `decisions/`
(engine-level living artifacts) and `<milestone>/tasks/` (milestone-scoped; active milestone is m1):

```bash
for f in docs/specs/weave/engines/*.md; do
  e=$(basename "$f" .md); echo "$e"
  grep -oE '^## (Brief|Product Requirements|Epics|Roadmap)' "$f"   # PO sections present
  ls -1 "docs/specs/weave/engines/$e/tech-spec" "docs/specs/weave/engines/$e/decisions" "docs/specs/weave/engines/$e"/*/tasks 2>/dev/null   # architect artifacts, if any
done
```

```
Spec Health (per entity):
  constitution-engine   phase: 01-brief    [brief ✓ | prd – | roadmap – | arch –]
  build-engine          phase: 01-brief    [brief ✓ | prd – | roadmap – | arch –]
  ...
```

**OKF conformance.** Run the bundle validator and surface the headline plus any per-file
issues (missing `type` frontmatter = hard error; broken cross-links = warning):

```bash
uv run .claude/scripts/okf_validate.py docs/ 2>&1 | tail -8
```

Report as:

```
OKF Bundle:  ✓ conformant (N concepts, M warning(s))   |   ✗ non-conformant (list errors)
  - missing frontmatter:  <files, if any>
  - broken cross-links:   <files, if any>
```

A non-conformant bundle is the single most important thing to flag here — it means a
spec-producing skill emitted a file without OKF `type` frontmatter, and `/okf-visualize`
plus any OKF-aware tooling will reject the bundle until it is fixed.

### Step 4: Suggest Next Action

Based on current state, suggest the logical next step:

| State | Suggestion |
|-------|-----------|
| No specs exist | "Run `/po` to start requirements elicitation" |
| Specs exist but no tech spec | "Run `/architect` to generate tech spec and tasks" |
| Tech spec exists but no tasks | "Run `/architect tasks` to decompose into task briefs" |
| Tasks in backlog | "Run `/implement` to start the implementation loop" |
| All tasks done | "All tasks complete. Consider running `/qa --full` for final review" |

## Evaluation Criteria

When testing this skill, verify:

- **Correct rendering**: Kanban board renders with correct columns (Backlog, In Progress, Review, Done) and tasks in the right columns
- **Accurate task status**: Task positions match their actual status in progress.json
- **Spec status accurate**: Each spec artifact correctly shows Not Started, In Review, or Approved based on file content
- **Summary counts correct**: Epic and task completion counts match the actual data
- **Next action appropriate**: Suggested next step matches the actual project state
- **Missing state handled**: Displays helpful message when progress.json does not exist
- **Empty state handled**: Displays correctly when no tasks exist yet (e.g., only specs phase)
