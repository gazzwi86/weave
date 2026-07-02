---
name: AWS access via named profile gazzwi86
description: All AWS access uses the pre-authenticated CLI profile gazzwi86 — never AWS_ACCESS_KEY_ID/SECRET env vars
type: reference
created: 2026-07-02
---

All AWS access in this repo goes through the named AWS CLI profile **`gazzwi86`**, which the
operator keeps authenticated locally (SSO-style login). Agents and scripts must set
`AWS_PROFILE=gazzwi86` (or pass `--profile gazzwi86`) and must **not** look for
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` environment variables, prompt to configure
credentials, or suggest `aws configure`.

**Why:** Credentials are session-scoped via the profile, consistent with the security rule that
secrets never live in env vars or `.env`. Hunting for key-pair env vars wastes turns and invites
hardcoding.
**How to apply:** Any Terraform, Bedrock, Cognito, or AWS CLI/SDK work assumes this profile. If a
call fails with an auth error, the fix is asking the operator to re-login on the profile
(`aws sso login --profile gazzwi86`), not swapping credential mechanisms. `run-loop.sh`'s
non-prod `AWS_PROFILE` assertion accepts this profile (it matches no prod pattern).
