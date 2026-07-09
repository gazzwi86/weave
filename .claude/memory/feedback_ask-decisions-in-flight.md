---
name: Ask decisions in-flight, don't defer them
description: When a real decision surfaces mid-task, ask the user immediately via AskUserQuestion — never pause, wait, or report it back as an unresolved open item
type: feedback
created: 2026-07-09
---

When a genuine decision or ambiguity surfaces while work is in flight — one the user must own and
that blocks or changes the work — **ask it immediately via `AskUserQuestion`**, inline, in the same
turn. Do not pause on it, do not "leave it untouched pending your answer", and do not finish the
rest and surface it as an open item for the user to volunteer a ruling on.

**Why:** user feedback 2026-07-09. A sub-agent found a live approved Constitution-engine mic
feature while purging voice input from Build, correctly declined to touch out-of-scope approved
work, and reported it back as an open question. The user's response: "You should have asked me a
question to resolve this when you were in flight, not waiting or refused to act." Reporting-and-
waiting costs the user a whole extra round-trip; a mid-task MCQ resolves it without breaking flow.
Refusing to act is only half-right — flag the boundary AND ask the question in the same breath.

**How to apply:** the moment a blocking decision appears mid-task, batch it into an
`AskUserQuestion` call (plain-language MCQ, trade-offs stated, recommended option first per the
CLAUDE.md Laws) rather than deferring. "Correctly scoped but unasked" is still a stall. This is the
counterpart to Law 1 (don't assume; surface trade-offs) — surfacing means *asking now*, not
*reporting later*. Applies especially to sub-agents: brief them to ask in-flight too, or to escalate
the question up to the coordinator to ask, never to park it. Links to [[feedback-right-sized-subagents]].
