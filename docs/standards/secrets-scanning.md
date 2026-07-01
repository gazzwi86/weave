---
type: Coding Standard
title: Secrets & PII Scanning — Coding Standard
description: "Rules and tooling for preventing hardcoded secrets and PII leakage."
tags: [standards, security, secrets]
timestamp: 2026-06-29T00:00:00Z
resource: docs/standards/secrets-scanning.md
---

# Secrets & PII Scanning

This project writes SME interview output, rule files, architecture shards, and context notes into git-tracked paths. Those files are untrusted input — interviewees paste production URLs, tenant IDs, bearer tokens, and customer names without thinking. A `PreToolUse` hook blocks writes that trip the scrubber before they reach disk.

## Gate

Every `Write` / `Edit` / `MultiEdit` tool call into these paths is scanned:

- `.claude/context/**`
- `.claude/rules/**`
- `.claude/skills/**`
- `.claude/state/context/**`
- `docs/architecture/**`

The scrubber runs `scripts/scrub-intake.sh` (not yet implemented — tracked for Constitution Engine phase). When implemented it will apply a built-in regex pack covering AWS/GCP/GitHub/Slack/Stripe tokens, JWTs, private keys, bearer headers, production hostnames, and PII shapes (emails, phones, IPs-in-prod-context). If `gitleaks` or `trufflehog` are on `PATH`, they run too.

On hit, the hook exits non-zero and the tool call is blocked with a stderr message naming the rule that fired.

## Staging for raw transcripts

Raw SME transcripts live under `.claude/_intake/` — **gitignored**, scrubber skipped for this path. The `interview` skill writes here. Only the scrubbed synthesis is promoted into git-tracked paths.

## Overriding

For local-only sessions (never for committed work) you can set:

```bash
export WEAVE_SCRUB=off
```

This disables the scrubber for the current shell. Do not persist this in a shell rc file. Do not set it in CI. CI runs should keep the scrubber on and fail the build if it fires.

## Extending the pattern set

The pack is intentionally conservative — it errs on the side of false positives because the blast radius of a leaked secret dwarfs the cost of rewriting a sentence. Add patterns to `scripts/scrub-intake.sh` (the `rules=(...)` array) when you observe a miss.

## Generated-code secret gate

Everything above describes the **intake scrubber** — a `PreToolUse` hook that *blocks a write
to disk* before untrusted human input (transcripts, rule files, context notes) reaches a
git-tracked path. The **generated-code secret gate** is categorically different and must not
be confused with it.

The Build Engine and Events & Actions Engine *generate code* (apps, agents, pipelines,
automations). That code is written to the spike / working tree — it already exists on disk.
The gate is a **pipeline stage that runs on the generated OUTPUT, after the code exists and
before commit (Build) or activation (Events)**. It does not block the write; it **fails the
generation**.

| | Intake scrubber | Generated-code secret gate |
|---|---|---|
| Trigger | `PreToolUse` on `Write`/`Edit` | Pre-commit (Build) / pre-activation (Events) pipeline stage |
| Input | Untrusted human-authored intake | Machine-generated code/artefact output |
| Timing | Before the file reaches disk | After the file exists, before commit/activation |
| On hit | Blocks the write (file never lands) | Fails the generation — task failed, atomic, no commit/activation |
| PRD | (harness intake) | Build E8-S1 / FR-010 / FR-029; Events E2-S3 / FR-008 |

### Fail-the-generation semantics

The gate **does not block a write** — the generated file is allowed to land in the
sandbox/working tree. Instead, on a hit:

- **Build Engine:** the secret-scan gate is one of the mandatory pre-commit gates (SAST,
  mypy/tsc, delta mutation ≥70%, package-existence, secret-scan, conformance — Build PRD
  E8-S1, FR-029). Generation is **atomic per task**: a mid-pipeline failure commits nothing
  (Build PRD E6-S2, "a mid-pipeline failure commits nothing", line ~704). The task is marked
  failed and classified per the four-class retry taxonomy (E6-S3).
- **Events & Actions Engine:** the secret-scan runs at **activation** (Events PRD E2-S3,
  FR-008). On a hit the automation is **not activated**. If the scanner itself is
  unavailable, activation is **fail-closed** (blocked), never activated unscanned
  (FR-008: "scanner unavailable → fail-closed").

So the failure mode is *no commit / no activation*, not *no write*. The generated code stays
on disk for the engineer to inspect and for the audit trail to reference; it simply never
becomes a committed artefact or a live automation.

### Required patterns

The gate **reuses the platform scrubber pattern set — it does not reinvent it** (Events PRD
FR-008: "Reuses the platform scrubber pattern set (does not reinvent)"). It runs the shared
`rules=(...)` array from `scripts/scrub-intake.sh` plus the generation-specific classes
below, which MUST be detected and MUST fail the generation:

- **AWS keys** — access key IDs (`AKIA[0-9A-Z]{16}`), secret access keys, session tokens.
- **Anthropic keys** — `sk-ant-` prefixed API keys. Generated agents call models via Bedrock
  using a Secrets Manager reference, never an inline key. Prototype evidence that this value
  is a secret, not a literal: `ANTHROPIC_API_KEY` is injected from AWS Secrets Manager in
  `prototypes/weave-prototype/infra/terraform/variables.tf:32` and `main.tf:54`.
- **Cognito credentials** — user pool client secrets, app-client secrets, and any inlined
  Cognito identity-pool credentials (auth is Cognito per CLAUDE.md).
- **Database DSNs** — connection strings with embedded credentials
  (`postgres://user:pass@host/db`, Aurora/SQLAlchemy URLs). Generated data pipelines and
  apps MUST reference Secrets Manager, never an inline DSN.

Any hit fails the generation. There is no `WEAVE_SCRUB=off` escape hatch for this gate — the
intake-scrubber override applies only to local intake writes, never to generated output bound
for commit or activation. CI keeps the gate on and fails the build if it fires.

This gate is exercised by the dark-factory behaviour tests in
[`testing-agents.md`](testing-agents.md#dark-factory-agent-behaviour-tests); a fired gate is
recorded to the immutable audit trail (`PLAT-AUDIT-1`) exactly like a sandbox BLOCK.

## Remediation

When the hook blocks a write:

1. Read the stderr message — it names the triggered rules.
2. Rewrite the content: replace real customer names with `<CUSTOMER>`, tenant IDs with `<TENANT>`, production URLs with `<PROD_HOST>`, tokens with `<REDACTED>`.
3. If the offending content is a transcript, move it to `.claude/_intake/` and re-run the promotion step so only the scrubbed synthesis reaches the tracked file.
4. Retry the write.

If the block is a false positive (rare): refine the regex in `scripts/scrub-intake.sh` rather than setting `WEAVE_SCRUB=off`. Overrides should never outlive a single local session.
