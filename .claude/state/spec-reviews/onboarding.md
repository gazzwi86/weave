# Spec review — onboarding

**Date:** 2026-07-02 · **Verdict:** PASS (after fixes) · **Reviewed by:** /spec-review (full-sweep; pre-build roadmap-level)

| # | Finding | Resolution |
|---|---|---|
| 1 | Whole-engine placement conflict: spec self-tagged an "M1 window (parallel)" slice; program roadmap says v1.0 and overrides self-tags (DEFECT A) | User decision 2026-07-02: **carve-out added to weave-spec §1.2** (W1–W4 row) — the CE+Explorer slice develops in parallel, never gates M1/M2 exit; first delivery stays Onboarding v1.0 |
| 2 | Entry criteria listed CE-METRICS-1 as "GA at M1 window" — it is CE M2 (DEFECT B) | Entry criteria corrected; E3-S2 starter widget M2-gated with graceful-omit |
| 3 | 59 story ACs Gherkin (EARS gate) | All converted; 0 `Given ` remain |
| 4 | Dangling ref to onboarding-content-brief.md | Annotated "(to be created — tracked in EPIC-001)" |

Gates: Brief PASS · PRD PASS (post-fix) · Roadmap PASS (post-carve-out). No tech-spec dir yet — correct for pre-build (builds v1.0); architecture capture list (sandbox isolation OQ-02, seed lifecycle, ADR-003 corpus alignment, tour framework, activation detection) recorded in the review transcript.
