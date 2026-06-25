---
description: Append a new ADR entry to ROADMAP.md section 4
allowed-tools: Read, Edit, Bash
---

Add a new Architecture Decision Record (ADR) to the append-only decision log in `ROADMAP.md`.

## Arguments

`$ARGUMENTS` — the ADR title and a brief description of the decision context. If not supplied, ask the user for: title, decision, rationale, and alternatives considered.

## Steps

1. Read `ROADMAP.md` to find the highest existing ADR number in section 4 and the exact insertion point (end of the list, before section 5).

2. Determine the next ADR number (highest existing + 1).

3. Draft the entry using this exact format:

```
- **ADR-NNN — Title** · YYYY-MM-DD ·
  *Decision:* one sentence. ·
  *Why:* rationale (1-3 sentences). ·
  *Alternatives:* what was considered and rejected; include any revisit triggers.
```

Where:
- NNN is zero-padded to three digits (e.g. `019`, `020`).
- YYYY-MM-DD is today's date.
- Each clause is separated by ` · ` (space-dot-space).

4. Append the entry to section 4 of `ROADMAP.md` after the last existing ADR entry.

5. Update the `Last updated:` date in the document header to today.

6. Show the user the new entry and confirm it was added.

**Never renumber or reorder existing entries.** The log is append-only.
