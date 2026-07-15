---
type: Task Brief
title: "Task: TASK-022 — Slack connector + PLAT-NOTIFY-1 Slack delivery channel (EPIC-006 v1)"
description: "Slack driver (token in Secrets Manager, chat.postMessage delivery, health ping)
  registered as a PLAT-NOTIFY-1 channel: per-user channel preference honoured, channel failure
  never blocks in-app delivery, failure itself recorded (E6-S1 v1 activation)."
tags: [weave-platform, arch, task, v1, connectors, slack, notifications]
timestamp: 2026-07-08T00:00:00Z
status: Backlog
priority: Must
entity: weave-platform
epic: EPIC-006
milestone: v1.0
created: 2026-07-08
blocked_by: [TASK-006, TASK-018]
unlocks: []
adr_refs: [ADR-017]
---

# Task: TASK-022 — Slack connector + PLAT-NOTIFY-1 Slack delivery channel

**Spec:** [weave-platform.md](../../../weave-platform.md) §EPIC-006 E6-S1 / FR-029, §EPIC-007
E7-S1 · **Contracts:** [contracts.md](../../../../contracts.md) `PLAT-CONNECTOR-1`,
`PLAT-NOTIFY-1`, `PLAT-AUDIT-1` · **Tech spec:** [v1-delta.md](../../tech-spec/v1-delta.md) §3, §7

## Story

**Epic:** EPIC-006 Notifications — Slack delivery channel (v1 activation, rides the connector)
**Priority:** Must

**As a** Weave user
**I want** my notifications delivered to Slack as well as in-app
**So that** critical events (budget, SHACL violations, connector degradation) reach me where I
work, without any risk of losing the in-app copy.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN a Slack connector is configured, THE SYSTEM SHALL store the bot token exclusively at `weave/{tenant_id}/slack/credentials` (TASK-006 machinery) and register `slack` as an available `PLAT-NOTIFY-1` channel for that tenant. | integration: `test_slack_config_registers_notify_channel` |
| AC-2 | WHEN a notification is published AND the recipient's preferences enable the Slack channel, THE SYSTEM SHALL deliver via `chat.postMessage` with the notification title, body, and a deep-link back to the relevant screen. | integration: `test_slack_delivery_posts_message_with_deeplink` |
| AC-3 | IF Slack delivery fails (invalid token, API error, timeout), THEN THE SYSTEM SHALL still deliver the notification in-app, record the channel failure itself to `PLAT-AUDIT-1`, and increment the Slack connector's `error_count` — the notification SHALL never be lost. | integration: `test_slack_channel_failure_still_delivers_inapp` |
| AC-4 | IF no Slack connector is configured for the tenant, THEN THE SYSTEM SHALL skip the Slack channel silently (no error, no audit noise) and deliver in-app. | unit: `test_slack_channel_skipped_when_unconfigured` |
| AC-5 | WHEN `ping()` probes Slack health, THE SYSTEM SHALL call `auth.test` and map `invalid_auth`/`token_revoked` to `disconnected`, timeout/5xx to `degraded` (TASK-006 semantics; canonical `connected/degraded/disconnected` enum); WHEN the connector degrades THE SYSTEM SHALL emit a `PLAT-NOTIFY-1` `connector-degraded` event (delivered in-app — no Slack self-loop). | unit: `test_slack_ping_maps_status_no_self_loop` |
| AC-6 | WHEN Slack rate-limits (`429` + `Retry-After`), THE SYSTEM SHALL retry once after the advertised delay, then fall back to AC-3 failure handling — never busy-loop. | unit: `test_slack_429_honours_retry_after_once` |
| AC-7 | IF a Slack API error payload would be logged, THEN the bot token SHALL be `[REDACTED]` in all stored text. | unit: `test_slack_error_redacts_token` |

## Pseudocode

```text
# packages/backend connectors/drivers/slack.py
class SlackDriver:
    mapping_profile = None                      # no graph ingest at v1 — delivery-only connector
    def ping():  POST auth.test (token from Secrets Manager)
    def deliver(channel_ref, payload):          # delivery interface, PLAT-CONNECTOR-1
        POST chat.postMessage {channel: channel_ref, text: render(payload), blocks: [...deep_link]}
        on 429: sleep(Retry-After); retry once  # AC-6
        on error: raise ChannelDeliveryError    # caught by notification service, AC-3

# notification service (M1 TASK-007 code) — channel registry gains one entry
CHANNELS = {"in_app": InAppChannel(), "slack": SlackChannel()}   # was in_app only at M1

def dispatch(notification, user):
    deliver in_app ALWAYS FIRST (existing M1 path — unchanged)   # AC-3 ordering guarantee
    user.prefs.channel_enabled("slack", notification.type):
        tenant has configured slack connector:                    # AC-4 gate
            try: slack.deliver(user.slack_ref, notification)
            except ChannelDeliveryError as e:
                audit(PLAT-AUDIT-1, "notify.channel_failure", redact(e))
                connector_health.increment_error("slack")         # AC-3
```

## API Contracts

- Slack Web API: `auth.test`, `chat.postMessage`. Bot token; **pinned OAuth scopes:
  `chat:write` (post to channels the bot is a member of) + `im:write` (open a DM when
  `user.slack_ref` is a user id, not a channel id)** — no other scopes; requesting broader
  scopes (e.g. `channels:read`, `users:read`) is a review Blocker (least privilege). Token
  shape opaque; Secrets Manager only (FR-031).
- `PLAT-NOTIFY-1` (contracts.md): open type taxonomy; this task adds a channel, never touches
  the taxonomy or the in-app path's shape.
- No new public platform endpoints; per-user channel toggles ride the existing M1
  notification-preferences surface (E6-S2 machinery).

## Diagram References

| Diagram | Path | Summary |
|---|---|---|
| Component delta | `../../tech-spec/v1-delta.md` §1 | NOTIFY → slack driver edge |
| Slack channel semantics | `../../tech-spec/v1-delta.md` §3 | Channel registry entry + failure ordering |

## Design Decisions

- [ADR-017](../../decisions/ADR-017.md) §4 — Slack is read/notify-only as a connector; its
  outbound surface IS this channel, not graph write-back. Impact: `mapping_profile = None`,
  no pull loop, no write-back executor involvement.
- v1-delta §3 — in-app delivers first, always; Slack is best-effort on top. Impact: the AC-3
  test asserts ordering, not just both-delivered.
- E6-S1 (PRD) — channel failure is itself recorded; a Slack-degraded notification must not
  route via Slack (AC-5 self-loop guard).

## Test Requirements

Minimum: 4 unit, 3 integration, 1 E2E.

| AC | Type | Test |
|----|------|------|
| AC-1 | Integration | `test_slack_config_registers_notify_channel` |
| AC-2 | Integration | `test_slack_delivery_posts_message_with_deeplink` |
| AC-3 | Integration | `test_slack_channel_failure_still_delivers_inapp` (fixture returns 500; assert in-app row + audit + error_count) |
| AC-4 | Unit | `test_slack_channel_skipped_when_unconfigured` |
| AC-5 | Unit | `test_slack_ping_maps_status_no_self_loop` |
| AC-6 | Unit | `test_slack_429_honours_retry_after_once` |
| AC-7 | Unit | `test_slack_error_redacts_token` |

E2E (Playwright): `slack-channel.spec.ts` — enable Slack in notification preferences (UI),
fire a test notification, assert the fixture Slack server received `chat.postMessage` AND the
in-app centre shows the notification (Law B: backend state + external double both asserted).
Doubles per v1-delta §7: Slack fixtures on the shared fixture server (TASK-019). Coverage
≥ 80 %, mutation ≥ 60 %.

## Implementation Hints

- Touch the M1 notification service ONLY at the channel registry seam — the in-app path is
  shipped, tested code; do not refactor it (CLAUDE.md Law 3).
- `user.slack_ref` (Slack user/channel id) is a per-user preference field; if absent, treat
  as AC-4 skip. Mapping Weave users → Slack ids is manual at v1 (a preferences field), not an
  identity-sync feature — do not build user-directory sync.
- Deep-link rendering: reuse the in-app notification's existing deep-link URL, wrapped in one
  Slack block — do not build a Slack-specific link scheme.
- The AC-5 self-loop guard is one line: `connector-degraded` events for connector `slack`
  force `channels = in_app only`. Test it — it is the classic infinite-loop bug.
- `Retry-After` can be seconds or HTTP-date; parse both, cap at 30 s.

## Cost Estimate

- **Complexity:** M
- **Estimated tokens:** ~40K input, ~20K output
- **Estimated cost:** ~$2.30

## Definition of Ready Checklist

- [x] ACs mapped to named tests; failure ordering, self-loop, 429, unconfigured paths explicit
- [x] Pseudocode shows the single-seam touch on M1 notification code
- [x] Slack scopes + endpoints pinned; token path per TASK-006 convention
- [x] E2E asserts both external double and backend state (Law B)
- [ ] TASK-006 complete (slack config + health rows) and TASK-018 complete (driver registry)

## Definition of Done Checklist

- [ ] All ACs green; coverage ≥ 80 %, mutation ≥ 60 %
- [ ] In-app delivery path untouched outside the channel-registry seam (diff review)
- [ ] No token in any log/audit/error text
- [ ] Self-loop guard test present and green
- [ ] Conventional commit: `feat: add slack connector and notify delivery channel`

## Dependencies

- **blocked_by:** TASK-006 (config/health/secrets), TASK-018 (driver registry; no pull loop
  used but the driver interface + health plumbing come from it)
- **unlocks:** — (v1 gate consumes it; E6-S1 Slack AC closes)

## Design requirements

Source bundle: **R10 — Notifications** (`docs/design/v1-design-requirements.md`), **channel-dimension
slice only** — grounded in `docs/design/notifications-recommendation.md` §Channels/§UX surfaces. The
rest of R10 (per-session batching of `model.version.published`, bell-panel day-grouping, the
non-suppressible `audit.chain.invalid` row) is **owned by `PLAT-V1-TASK-027`** (app-shell brief),
not this task — see cross-reference below.

This task's only UI surface is the Settings → Notifications preference matrix gaining a `slack`
column; the matrix itself (rows = types, columns = channels) is existing M1 UI (E6-S2), not built
here.

- **Preference schema carries the channel dimension** (R10, `v1-design-requirements.md:101`;
  `notifications-recommendation.md` §Channels: "the preference schema carries a `channel` dimension
  from day one") — the per-user preference payload's `channel` field gains `slack` as a sibling
  value to `in_app`/`email`, same shape, not a bolt-on field.
- **Email column: disabled, "post-v1" pill** (R10; `notifications-recommendation.md` §UX surfaces
  #2: "email column pre-rendered disabled with a `post-v1` phase pill, consistent with the rail's
  placeholder pattern") — this task does not touch the email column, but the Slack column must be
  added without disturbing that existing disabled/pill treatment. Placeholder-pill convention:
  `poc-ia-proposal.md:30`, "render disabled with label 'Delivered in phase X'".
- **Slack column: same matrix presentation, enabled** (R10 channel-dimension slice; this task's
  AC-1/AC-4) — the Slack column uses the identical cell treatment as the existing in-app column
  (same toggle control, same row height, same header style) and is interactive, not disabled,
  reflecting that Slack ships at v1 while email does not.
- Token bindings for the toggle control: components.md input/toggle states (default, hover,
  focus-visible with `--ring-focus`, disabled) — the Slack column's toggle is never in the
  `disabled` state (that's the email column's role); pill styling (email column only) per
  components.md badge/chip treatment (`--radius-full`, `--text-caption`, `--space-1` soft-bg,
  `components.md:106-107`); row dividers `--color-border-soft` (`color.md:63`); labels
  `--text-body-sm` (`typography.md:66`).

ADVISORY (not cited, flagged): no dedicated preferences-matrix organism/template exists yet in the
design-system library (R13, `PLAT-V1-TASK-026`). Build the Slack column onto the existing M1 matrix
markup as-is (CLAUDE.md Law 3 — touch only what you must); do not invent a new matrix component for
one column.

CROSS-REFERENCE: notification batching (`model.version.published` collapsed per session), bell
panel day-grouping/deep-links/mark-read, and the non-suppressible `audit.chain.invalid` row for
admin + compliance are the remainder of R10 and are attached to **`PLAT-V1-TASK-027`**
(app-shell brief) — not duplicated here.

GAPS: none — `docs/design/jtbd.md` "Settings" entry names "Notifications prefs (`PLAT-NOTIFY-1`)"
explicitly as a success criterion, covering this slice.
