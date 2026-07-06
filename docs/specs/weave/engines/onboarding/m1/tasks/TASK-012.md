---
type: Task
title: "Task: TASK-012 — Training Library & What's New"
description: "The self-paced training surface: searchable placeholder video cards (CloudFront URL
  shape, native player) + written walkthroughs by category, post-v1 categories flagged, and the
  What's-new feed with unread dot."
tags: [onboarding, arch, task, phase-1, m1]
status: Backlog
priority: Must Have
entity: onboarding
epic: EPIC-006
milestone: m1
created: 2026-07-06
blocked_by: ["TASK-001", "TASK-003"]
unlocks: ["TASK-013"]
adr_refs: [ADR-006]
source: hand-authored
confirmed_by: "none"
confirmed_on: null
last_verified_sha: null
expires_on: 2026-12-30
owner: gazzwi86
coverage: "n/a"
---

Engine spec: [onboarding.md](../../../onboarding.md) E6-S1/E6-S2

## Story

As a new user, I want a training library I can search and learn from at my own pace, and a
"What's new" feed that tells me what changed — beyond what tours cover, whenever I want it.

## Scope Note

Frontend only + one state field. Renders TASK-003 config: video cards (thumbnail placeholder
"Video — coming soon" until a `video_id` exists; native `<video>` against the CloudFront URL
shape when it does — ADR-006), written walkthroughs (Markdown + screenshots), categories
(Introduction, Ontologies, Graph Explorer, Build*, Automation*, Compliance & Governance,
Administration — * flagged "available when the engine ships"), client-side search over a config
index, and the What's-new panel (last N items, default 5 tunable) with the unread blue dot
driven by `whats_new_seen_at` (TASK-001). No video production, no upload pipeline, no S3 infra
in this slice (placeholders only). Launcher entries are TASK-013.

## Acceptance Criteria

| ID | Criterion (EARS) |
|---|---|
| AC-012-01 | WHEN the training library opens THE SYSTEM SHALL show video cards (placeholder thumbnail, title, duration, description) and written walkthroughs, organised by the seven categories with post-v1 categories visible but flagged (FR-023/FR-024). |
| AC-012-02 | WHEN a keyword is entered THE SYSTEM SHALL filter across video and written content within a default ≤ 300 ms (tunable) target. |
| AC-012-03 | IF a video asset fails to load or play THEN THE SYSTEM SHALL show the card's placeholder/error state — never a broken player (E6-S1 failure mode); WHERE no `video_id` exists THE SYSTEM SHALL show "Video — coming soon". |
| AC-012-04 | WHEN "What's new" opens THE SYSTEM SHALL show the last N release items (default 5, tunable) with version, date, headline, description; unread items SHALL drive a blue dot on the help icon, cleared by updating `whats_new_seen_at` (FR-025). |
| AC-012-05 | IF the release feed config is empty/unavailable THEN THE SYSTEM SHALL show the panel's empty state, never an error blocking the launcher. |
| AC-012-06 | WHEN any library/changelog string renders THE SYSTEM SHALL use i18n keys; the surface SHALL be axe-clean and keyboard-operable; tokens throughout. |

## API Contracts

Engine-internal: `PATCH /api/onboarding/state` (`whats_new_seen_at`). Video URLs follow the
ADR-006 CloudFront shape — no runtime AWS call in this slice.

## Diagram

architecture.md §Level 2 (overlay container + CDN edge); content shapes in data-model.md
§Content Config Schemas.

## Design Decisions

| Decision | Rationale | Source |
|---|---|---|
| Placeholder-first cards around a fixed URL shape | Real video later = data change, zero card rework | ADR-006 |
| Native `<video>`, no player lib | Platform feature covers it; captions via `<track>` later | ADR-006 |
| Search over a build-time config index | Content is code; no search service for dozens of items | ADR-006 |
| Unread dot = one timestamp cursor | Simplest correct unread semantics | data-model.md |

## Test Requirements

| Layer | Scenario | AC |
|---|---|---|
| Unit | Card states: placeholder / playable / error fallback | AC-012-03 |
| Unit | Category rendering incl. flagged post-v1; empty feed state | AC-012-01/05 |
| Unit | Search filter correctness + ≤ 300 ms perf check on full config | AC-012-02 |
| Integration | Unread dot: new item after `whats_new_seen_at` ⇒ dot; open ⇒ cleared | AC-012-04 |
| E2E | Open library from launcher, search, open a walkthrough; axe pass | AC-012-01/06 |

## Dependencies

- **blocked_by**: TASK-001 (seen cursor), TASK-003 (training/What's-new config)
- **unlocks**: TASK-013 (launcher entries)

## Cost Estimate

**S** — config-driven rendering with three card states and a text filter.

## DoR Checklist

- [ ] TASK-003 training/What's-new content merged
- [ ] CloudFront URL shape constant agreed (ADR-006)
- [ ] Written-walkthrough Markdown rendering approach confirmed with the design system

## DoD Checklist

- [ ] All ACs pass; search perf check green on the full M1 content set
- [ ] No broken-player path reachable (error fallback exercised)
- [ ] `ui_verify` passes; axe zero-violations
- [ ] Coverage ≥ 80%, mutation ≥ 60% on filter + card-state logic

## Implementation Hints

Search: lowercase substring match over title+description+category built once at module load —
no index library for this volume. <!-- ponytail: substring match; swap in fuse.js only if
content grows past hundreds of items --> The unread dot belongs to the help icon (TASK-013
renders it) — expose a tiny `useWhatsNewUnread()` hook from this task so the launcher consumes
it without duplicating cursor logic.
