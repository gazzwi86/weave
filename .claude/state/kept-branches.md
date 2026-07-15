# Kept local branches (housekeeping 2026-07-15)

After the program-v1 build wave closed, the git cleanup pass deleted 6 confirmed-merged branches
(`chore/m1-signoff`, `feature/BE-V1-EPIC-001`, `-011`, `-012`, `feature/CE-V1-EPIC-005`,
`fix/ci-green` — all merged via squash PR, verified by `gh pr list`, no post-merge commits).

Three local branches were **deliberately kept**. This note is their paper trail so they are not
mistaken for orphans.

| Branch | Why kept | Un-landed work | Trail |
|---|---|---|---|
| `feature/BE-V1-EPIC-002` | PR #48 merged, but one commit lands ~1.5h **after** the merge | Post-merge commit is a `docs(memory)` note — no lost code. Epic + all 8 tasks `done` in `progress.json`. | Ledger `XT-BE013-1` (PARTIALLY-RESOLVED) cites its commits `86eeb3b`/`e06642b`. |
| `feature/poc-usability` | Active per project memory `project_poc-usability-drive` | Only un-landed commit is a **stale** `BE-TASK-007 in_progress` state marker (task since `done`) — nothing to preserve. | Merged as PR #40; project memory documents the drive. |
| `ge005-backup` | Backup of **GE-TASK-005** Graph Explorer work with **no task record** — needs keep/drop decision | 14 real feat/test commits + ADR-004 (domain-focus, `NodeContextMenu`, `useNeighbourExpansion`, `DomainFocusNotice`), only on this branch + `origin`. | ⚠️ **No prior trail.** Now tracked as `PROJ-GE005-RECONCILE` in `qa-project-issues.md`. |

## Open action

`ge005-backup` is the only unresolved one. Verify the CE-V1 Explorer implementation
(CE-V1-TASK-023/024, ADR-025) covers GE-TASK-005's acceptance criteria; drop the branch once
confirmed, or file a CE post-v1 port task if gaps exist. Tracked: `PROJ-GE005-RECONCILE`.

Recovery: all deleted branches remain on `origin/*` and in the local reflog — nothing is lost.
