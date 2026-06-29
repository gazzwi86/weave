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

## Remediation

When the hook blocks a write:

1. Read the stderr message — it names the triggered rules.
2. Rewrite the content: replace real customer names with `<CUSTOMER>`, tenant IDs with `<TENANT>`, production URLs with `<PROD_HOST>`, tokens with `<REDACTED>`.
3. If the offending content is a transcript, move it to `.claude/_intake/` and re-run the promotion step so only the scrubbed synthesis reaches the tracked file.
4. Retry the write.

If the block is a false positive (rare): refine the regex in `scripts/scrub-intake.sh` rather than setting `WEAVE_SCRUB=off`. Overrides should never outlive a single local session.
