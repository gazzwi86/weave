# docs/CLAUDE.md

Design notes and evolving architecture documentation for Weave.

## What belongs here

- `tree-of-thought.md` — hypotheses, architecture decisions in flight, open design questions, and the evolving plan of action. Update this alongside ROADMAP.md after each significant task.
- Design explorations, UX sketches, and technical deep-dives that inform but do not fit cleanly into the ADR log.

## What does NOT belong here

- ADRs (append-only decision log) — those live in `ROADMAP.md` section 4.
- Deep-research reports — those live in `.claude/research/` and are named `YYYY-MM-DD-<topic>.md`.
- README / user-facing docs — those live in the repo root.

## ADR format (in ROADMAP.md)

Every non-trivial decision gets an ADR entry appended to section 4 of `ROADMAP.md`. Use this exact format:

```
- **ADR-NNN — Title** · YYYY-MM-DD ·
  *Decision:* one sentence. ·
  *Why:* rationale. ·
  *Alternatives:* what was rejected and why (optional: revisit triggers).
```

Where NNN is the next sequential integer. Do not reorder existing entries. The log is append-only.

## tree-of-thought.md conventions

- Organise by hypothesis or architectural concern, not chronology.
- When a hypothesis is confirmed or rejected, mark it and note the evidence.
- Cross-reference ADRs by number when a hypothesis resolves into a decision.
- Keep it concise — it is a working scratchpad, not polished documentation.
