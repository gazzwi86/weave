---
name: GitHub Actions unavailable until 2026-08-01
description: GH Actions credits exhausted; no CI runs until 2026-08-01 — gates use local verification with waiver
type: project
created: 2026-07-08
expires: 2026-08-01
---

GitHub Actions credits are exhausted — no CI runs are possible until the reset on **2026-08-01**.

**Why:** plan credit limit hit mid-cycle (user-confirmed 2026-07-08). "Pushed green main" cannot be
satisfied via CI until then.

**How to apply:**
- Defer PR-pipeline fixes and any CI-dependent gate steps until 2026-08-01; pick them up then.
- Phase gates (incl. the M1 re-gate) substitute local verification — full test pyramid,
  mutation-strict, `ui_verify --full`, `/security-review` — with an explicit user-approved waiver
  recorded in the signoff doc (e.g. `PROGRAM-M1-SIGNOFF.md`). Documented substitution, not a
  weakened gate.
- After 2026-08-01: re-run CI on main and clear the waiver.
