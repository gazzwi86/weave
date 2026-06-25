---
name: Harness architecture decisions
description: Skill decomposition, HITL gate placement, loop mechanism, and dark factory design for the Weave build harness
type: decision
created: 2026-06-25
---

Skills are decomposed from persona monoliths (one file per role) to **per-artifact skills**
(one deep skill per spec template). Persona agents (`agents/product-owner.md` etc.) become
orchestration shells that call skills in sequence.

**Skill granularity:** per artifact/template (1:1 with `.claude/spec-templates/`). Rejected:
per-section (too fine, ~30+ skills), per-phase (too coarse, loses section depth).

**HITL gates:**
- Spec writing (PO + Architect): section-by-section within each artifact
- Dark factory (implementation only): **phase-gated groups of epics** — all epics in a phase
  complete → `phase_gate()` Stop hook → human reviews. Phases and their HITL checkpoint
  notes are declared in the roadmap artifact by the PO. Gate is NOT per-epic.

**Loop mechanism:** `/goal` CLI built-in (v2.1.139+, confirmed from primary docs). After each
turn, Haiku evaluates whether the condition is met. The dark factory uses:
`/goal all tasks in current phase done, or stop after 60 turns`
The 60-turn cap is expressed as a clause in the condition — no hand-rolled counter in
`progress.json`. `phase_gate()` is a separate command-based Stop hook that fires the HITL
ceremony when a phase completes. They are complementary, not conflicting.

**Edit target:** `.claude/skills/` only.

**State spine:** `.claude/state/progress.json` committed after every task (not just phase) so
overnight routines on a fresh clone see accurate state. `progress.sh` is in
`.claude/scripts/progress.sh` (task ZERO — done 2026-06-25).
State directory is `.claude/state/` (not `docs/state/` — moved 2026-06-25 to keep all harness
artefacts together under `.claude/`).

**Why:** Monolithic skills produce shallow quality per artifact, lack model right-sizing, and
have no cost-controlled autonomous loop. Per-artifact decomposition addresses all three.

**How to apply:** When writing or updating skills, ensure each maps to one template artifact.
Implement loop uses `/goal` (not a custom loop), NOT a hand-rolled turn-counter. Spec path
is `.claude/specs/` not `docs/specs/`. Gate function is
`phase_gate()`, not `epic_gate()`. Per-artifact skills live in `.claude/skills/<name>/SKILL.md`.
