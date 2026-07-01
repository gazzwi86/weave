---
type: Coding Standard
title: Git Workflow — Coding Standard
description: "Branching, conventional commits, and stacked-PR conventions."
tags: [standards, git]
timestamp: 2026-06-29T00:00:00Z
resource: docs/standards/git-workflow.md
---

# Git Workflow

**Stack-agnostic.** Language-specific tooling (husky, pre-commit) is covered
in [`tooling-ts.md`](tooling-ts.md) and [`tooling-py.md`](tooling-py.md).

## Commit format — Conventional Commits

```
<type>(<scope>)?: <description>

[optional body]

[optional footer]
```

### Types

| Type | When |
|---|---|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `test` | Adding or updating tests |
| `refactor` | Code change that neither fixes nor adds a feature |
| `chore` | Build, config, tooling, housekeeping |
| `docs` | Documentation only |
| `style` | Formatting (no logic change) |
| `perf` | Performance improvement |
| `build` | Build-system changes |
| `ci` | CI config changes |

### Rules

- **Subject:** imperative mood, max 72 chars, no period.
- **Body:** explain WHY. The diff already shows WHAT.
- **One logical change per commit.** Do not bundle unrelated changes.
- **≤ 300 LOC additions per commit** where reasonable. Deletion-only commits
  exempt. Generated-code commits (lockfiles, schema snapshots) exempt but must
  be isolated into their own commit.
- **Tests and implementation in separate commits** when possible
  (test-first TDD keeps this natural).

## Stacked PRs by construction

Every Weave run produces **stacked PRs** — multiple small commits inside
each PR, and PR N+1 branches off PR N (not `main`). This gives reviewers a
readable history they can consume piece-by-piece instead of a single
multi-thousand-line blob.

### Topology

```
main
 ├── feat/phase-1-foo
 │     ├── test: add failing tests for A
 │     ├── feat: implement A
 │     └── refactor: simplify A
 │   (PR #1, base = main)
 │
 └── feat/phase-2-bar              ← branches off feat/phase-1-foo
       ├── test: add failing tests for B
       └── feat: implement B
     (PR #2, base = feat/phase-1-foo)
```

### Rules

1. **One PR = one phase / one epic.** Multiple commits inside.
2. **PR N+1 base = PR N branch**, not `main`. Use
   `gh pr create --base <prev-branch>`.
3. **Each PR description lists:** scope summary, per-commit diff summary,
   AC checklist, explicit dependencies on prior PRs.
4. **After merge of PR N to main**, rebase the remaining stack:
   `git rebase --onto main <prev-base> <current-branch>` (or rely on GitHub's
   automatic base-branch retargeting).
5. **Never force-push published stacked branches** without coordinating with
   any reviewer who has already commented.

### When NOT to stack

- Hotfixes that must land immediately on `main` (emergency patch).
- Experiments that will be discarded — prototype in a throwaway branch.
- Single-commit changes (trivial docs fix). Stacking overhead isn't worth it.

## PR description template

```markdown
## Scope

{{one-sentence summary}}

## Stack position

- **Base branch:** `{{prev-phase-branch | main}}`
- **Depends on:** #{{prev-pr-number}} (if applicable)
- **Next in stack:** {{next-phase-branch | none}}

## Commits

- `{{sha}}` — {{subject}}
- `{{sha}}` — {{subject}}

## Acceptance criteria

- [x] AC-1: {{criterion}}
- [x] AC-2: {{criterion}}

## Verification

- Tests: {{unit count}} / {{integration count}} / {{e2e count}}
- Coverage: {{%}}
- Lint: {{pass/fail}}
- Complexity gates: {{pass/fail, waivers?}}

## Screenshots / traces

{{if UI: before/after or Playwright trace path}}
```

## Pre-commit / pre-push hooks

**Essential.** Language-specific configuration lives in the tooling overlays
([`tooling-ts.md`](tooling-ts.md), [`tooling-py.md`](tooling-py.md)).
Every stack must wire up:

- **Pre-commit:** lint + type-check + affected tests on staged files.
- **Pre-push:** full test suite + dependency/security audit.
- **Never bypass** with `--no-verify`. A failing hook means the change isn't
  ready — fix the issue instead.

## Worktree isolation

Each agent operates in its own git worktree (configured in the agent's
frontmatter, `isolation: worktree`):

- Engineer gets an isolated worktree for implementation.
- QA gets an isolated worktree for review and test extension.
- Merges back to the phase branch on approval.

---
