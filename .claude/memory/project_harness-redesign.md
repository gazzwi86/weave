---
name: Harness redesign in progress
description: Per-artifact skills being built; /goal confirmed real; phase_gate HITL; TASK ZERO done
type: project
created: 2026-06-25
expires: 2026-07-14
---

Harness redesign is complete. Living orientation doc at `docs/claude-harness-overview.md`
(self-contained — decisions table in §14). Council of 6 complete; findings were folded
into the redesign spec, now archived locally (untracked).

**Completed (2026-06-25):**
- `docs/claude-harness-overview.md` written
- `CLAUDE.md` stack section added
- Council of 6 run and findings folded into spec §11
- `/goal` confirmed as real CLI built-in (primary source verified); spec §4.3 restored
- Gate renamed `phase_gate()` (not `epic_gate()`); gate is phase-level (PO-defined in roadmap)
- TASK ZERO: `progress.sh` ported to `.claude/scripts/`; `.claude/state/` created
- `settings.json` updated with `commit-progress` PostToolUse hook
- Spec §4.3, §5.3, §5.5, §6, §8, §11 B1 all corrected
- Per-artifact skills created via Workflow (17 skills): po-brief, po-prd, po-roadmap, po-epic, arch-* (13), phase-gate
- `agents/product-owner.md` updated → orchestration shell calling po-* skills
- `agents/tech-architect.md` updated → orchestration shell calling arch-* skills
- `implement/SKILL.md` updated → `/goal`, Weave paths, phase-gate
- `stop.py` updated → `phase_gate()` added (replaces `completion_review`), false-positive guard added
- `lifecycle.py` updated → `subagent_stop()` enhanced
- State directory moved: `docs/state/` → `.claude/state/` (all references updated)
- Old monolithic skills deleted: `po/SKILL.md`, `architect/SKILL.md` (superseded by decomposed skills)

**Harness is complete. Ready to start Weave specs via `/po`.**

**Why:** Per-artifact skills, model right-sizing, and phase-gated dark factory loop are
prerequisites before Weave's own Constitution Engine build phases start.

**How to apply:** Check this memory before starting harness work — prevents duplicate steps.
