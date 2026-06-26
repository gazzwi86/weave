---
name: Naming convention — no codenames
description: All Weave features/tools/capabilities use descriptive, human-intelligible names; codenames (BluShift, Polaris, etc.) are dropped
type: decision
created: 2026-06-26
---

Weave features, tools, engines, and capabilities must be named with sensible,
inferrable, human-intelligible names that explain what the thing does. Codenames and
legacy project names are dropped.

**Dropped legacy codenames:**
- **BluShift** → the product is **Weave** (and its engines: Constitution, Build,
  Events & Actions, Graph Explorer).
- **Polaris** → describe by function, e.g. "self-improvement engine" / "platform
  self-improvement" / "engine self-improvement capability".

**Why:** Codenames hide capability and raise the comprehension cost for users, buyers,
and engineers. A name should let a reader infer the tool's purpose without a glossary.
The prototype docs (`prototypes/BluShift-transcript.md`, `prototypes/thoughts.md`) use
the old codenames — treat their *content* as authoritative but rename on the way in.

**How to apply:** When writing specs, UI labels, code, or docs, never introduce a
codename. Use a descriptive noun phrase that states the capability (e.g. "Build Engine",
"compliance/decision log", "operational self-healing", "self-improvement engine"). If a
prototype doc references BluShift or Polaris, translate to the descriptive Weave name.
See [[decision_platform-strategy]] for the engine set.
