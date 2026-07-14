# Progress: PLAT-V1-TASK-027 — App-shell v2 (V4-hybrid chrome refit) (EPIC-011, LAST task → closes epic)

`weave-platform` EPIC-011 (design-system uplift). Worktree `../weave-PLAT-V1-EPIC-011`, branch `feature/PLAT-V1-EPIC-011`
(off origin/main; PLAT-026 done+merged atoms are the base this builds on — but EPIC-011 itself unmerged until now). Frontend-only.
Built across ~6 continuations (overflow-heavy app-shell refit). Coordinator-authored pre-QA. HEAD `b3706518` (+ hydration fix pending).

## What shipped (9 ACs, all met per QA)
Full app-shell refit consuming PLAT-026 organisms: AC-1 NavRail/SecondarySidebar + collapse-persist · AC-2 PageHeader
`--text-h1` · AC-3 Cmd+K CommandBar grouped (Nav/Entities/Actions) + z-command · AC-4 BellPanel day-grouped + deep-link +
mark-read, mounted in notification-center + `/notifications` route · AC-5 session-batched model.version.published · AC-6
audit.chain.invalid non-suppressible (can-suppress.ts) · AC-7 avatar menu (profile/role/help/sign-out) · AC-8 workspace
switcher retired + header-scope.ts resolver (provisioning → Settings) · AC-9 EntityRef/RelativeTime sweep.

## QA PASS (2026-07-11, acec08a) — all 9 ACs, 799 vitest + 3 E2E green
Verified by source-read per AC (not report-trust). AC count reconciled: brief has 9 (no gap; AC-2 exists+done, engineer's
"1,3,4..9" note was mis-bookkeeping). 3 E2E ran GREEN live (sidebar-collapse, command-bar, bell-panel) — shell-chrome, need
no project-creation so no PROJ-009/010. tsc 0, eslint 0-err, no backend changes. Edge test `7a4e799c` (non-'true' localStorage
→ expanded). retry=0.

## 3 QA findings
1. **REAL SSR/hydration mismatch (section-rail.tsx useCollapsed)** — localStorage in useState initializer → server "expanded"
   vs client "collapsed" → hydration warning + label flash; waitForLoadState masked symptom not cause. **BEING FIXED before
   merge** (useState(false) + useEffect flip) — it's the shell, renders everywhere.
2. **PLAT-TOKEN-1 (logged, follow-up):** `command-palette.tsx max-w-[560px]` + `avatar-menu.tsx max-w-[240px]` hard-code px
   (shell/** is exempt from the weave/token-conformance rule — pre-existing TASK-026-era carve-out); siblings use max-w-xl/xs.
   Narrow (width only, not colour/motion). → design-debt sweep.
3. **XT-PLAT027-E2E (logged, follow-up):** bell-panel-day-grouping.spec.ts mocks the notifications API wholesale (Law B gap —
   asserts a mocked POST fired, not real backend read:true). Other 2 E2E fine (real routing/localStorage). → add a real
   GET /api/notifications assertion (TASK-007 owns PLAT-NOTIFY-1 backend test).

## Gates
tsc 0 · eslint 0-err (153 pre-existing warns) · vitest 799/799 (145 files) · 3 E2E green live · no backend changes.

## Epic status — EPIC-011 CLOSES on hydration-fix confirm → merge (unblocks BE-024)
PLAT-027 = last task. On the section-rail hydration fix landing green → close EPIC-011: reconcile onto green main (frontend-only,
likely clean — but check for design-system file overlaps), push, PR, review, CI → **auto-merge (non-risky, no migration) →
lands EntityRef/KindChip atoms on main → BE-024 unblocks** (resume its parked worktree off refreshed main).
