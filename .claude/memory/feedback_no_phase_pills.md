---
name: No milestone phase pills in UI
description: Shipped features get no phase pill; unbuilt features render disabled with a plain
  "soon" pill. Supersedes poc-ia-proposal.md pill vocabulary (M1/M2/v1 pills).
type: feedback
created: 2026-07-17
---

Shipped features carry **no milestone pill** ("M1 — this pass", "v1", "M2" etc. are banned from
the UI). Features that exist in the IA but are not yet built render **disabled with a plain
"soon" pill** — no internal milestone jargon shown to users.

**Why:** User ruling 2026-07-17 during the UI refit — milestone pills are internal roadmap
bookkeeping and confused the product surface. This supersedes the pill vocabulary in
`docs/design/poc-ia-proposal.md` (lines ~29-30, ~180) which specced M1/M2/v1.0/post-v1 pills.

**How to apply:** Remove existing phase pills when refitting any screen; navigation items for
unbuilt areas (e.g. Events, Reasoning) = disabled + "soon". The living mock
`docs/design/mocks/refit-mock.html` shows the pattern.
