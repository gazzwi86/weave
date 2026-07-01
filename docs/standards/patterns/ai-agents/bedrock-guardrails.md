---
type: Coding Standard
title: "Amazon Bedrock Guardrails — Contextual Grounding, PII, and Fail-Closed Handling (python)"
description: "Golden pattern for guarding a Claude model response with a Bedrock Guardrail: contextual-grounding threshold 0.75, PII detection, and fail-closed handling on GUARDRAIL_INTERVENED and on error."
tags: [standards, patterns, ai-agents, python]
timestamp: 2026-07-01
resource: docs/standards/patterns/ai-agents/bedrock-guardrails.md
topic: ai-agents
stack: python
verification: "UNVERIFIED (docs-only, 2026-07-01) — not run against a live SDK; validate before first use"
sources:
  - https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ApplyGuardrail.html
  - https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails-contextual-grounding-check.html
  - https://docs.aws.amazon.com/bedrock/latest/APIReference/API_CreateGuardrail.html
---

# Amazon Bedrock Guardrails — Contextual Grounding, PII, and Fail-Closed Handling (python)

**Intent.** Wrap a Claude model response with a Bedrock Guardrail before releasing it to a
user: run a contextual-grounding check (grounding + relevance threshold 0.75), detect/mask
PII, and **fail closed** — if the guardrail intervenes *or* the guardrail call itself
errors, never return the raw model output. Grounding runs on OUTPUT only (a model response
is required), so the guarded call uses `source="OUTPUT"`.

```python
"""Guard a model response with ApplyGuardrail, fail-closed.

Confirmed primary-source shapes:
  apply_guardrail request/response, action enum, contextualGroundingPolicy filters
    — API_runtime_ApplyGuardrail + guardrails-contextual-grounding-check
  contextualGroundingPolicyConfig / sensitiveInformationPolicyConfig
    — API_CreateGuardrail
"""

import boto3
from botocore.exceptions import BotoCoreError, ClientError

# The 0.75 threshold is configured once at guardrail-creation time (below).
# grounding/relevance thresholds are configurable 0..0.99; 1 is invalid.
GROUNDING_FLOOR = 0.75  # app-side defense-in-depth, mirrors the guardrail config


class GuardrailBlocked(Exception):
    """Raised whenever output must not be released. Callers map this to HTTP 503."""


# --- One-time config (Terraform/IaC in prod; shown here as the API shape) ----
def create_grounding_guardrail(bedrock: "boto3.client") -> dict:
    return bedrock.create_guardrail(
        name="weave-grounding",
        blockedInputMessaging="Request blocked by policy.",
        blockedOutputsMessaging="Response withheld: could not be grounded in the source.",
        contextualGroundingPolicyConfig={
            "filtersConfig": [
                {"type": "GROUNDING", "threshold": 0.75, "action": "BLOCK", "enabled": True},
                {"type": "RELEVANCE", "threshold": 0.75, "action": "BLOCK", "enabled": True},
            ]
        },
        sensitiveInformationPolicyConfig={
            "piiEntitiesConfig": [
                {"type": "EMAIL", "action": "ANONYMIZE"},
                {"type": "US_SOCIAL_SECURITY_NUMBER", "action": "BLOCK"},
            ]
        },
        # UNVERIFIED shape — confirm against the current CreateGuardrail schema.
        # REQUIRED for screen_input to actually catch prompt-injection: the
        # sensitiveInformationPolicy above screens PII on INPUT, but without a
        # prompt-attack contentPolicy filter the source="INPUT" screen no-ops on
        # injection. Wire a PROMPT_ATTACK filter here before relying on it.
        contentPolicyConfig={
            "filtersConfig": [
                {"type": "PROMPT_ATTACK", "inputStrength": "HIGH", "outputStrength": "NONE"},
            ]
        },
    )


# --- Runtime: screen the USER PROMPT before the model call -------------------
def screen_input(
    *,
    guardrail_id: str,       # from AWS Secrets Manager, never hardcoded
    guardrail_version: str,  # pinned version string, e.g. "1" (never "DRAFT" in prod)
    user_query: str,
) -> None:
    """Pre-filter the user prompt for prompt-injection and PII BEFORE the model runs.
    Raise GuardrailBlocked if the guardrail intervenes or the call errors (fail closed).

    REQUIRED as the first-line prompt-injection control — the agent's system prompt is
    defense-in-depth, not the gate. UNVERIFIED: the exact prompt-attack policy config
    (e.g. contentPolicyConfig PROMPT_ATTACK filter) is not confirmed against the current
    CreateGuardrail schema — verify before use.
    """
    client = boto3.client("bedrock-runtime")  # ambient IAM role via STS
    try:
        result = client.apply_guardrail(
            guardrailIdentifier=guardrail_id,
            guardrailVersion=guardrail_version,
            source="INPUT",  # screens the prompt, not a model response
            content=[{"text": {"text": user_query, "qualifiers": ["query"]}}],
        )
    except (ClientError, BotoCoreError) as exc:
        raise GuardrailBlocked("input guardrail unavailable") from exc
    if result["action"] == "GUARDRAIL_INTERVENED":
        raise GuardrailBlocked(result.get("actionReason", "input_blocked"))


# --- Runtime: guard a model response -----------------------------------------
def guard_response(
    *,
    guardrail_id: str,       # from AWS Secrets Manager, never hardcoded
    guardrail_version: str,  # pinned version string, e.g. "1" (never "DRAFT" in prod)
    grounding_source: str,   # the retrieved context the answer must be grounded in
    user_query: str,
    model_response: str,
) -> str:
    """Return released text, or raise GuardrailBlocked. Never returns raw output on doubt."""
    client = boto3.client("bedrock-runtime")  # ambient IAM role via STS

    try:
        result = client.apply_guardrail(
            guardrailIdentifier=guardrail_id,
            guardrailVersion=guardrail_version,
            source="OUTPUT",  # grounding requires the model response
            content=[
                {"text": {"text": grounding_source, "qualifiers": ["grounding_source"]}},
                {"text": {"text": user_query, "qualifiers": ["query"]}},
                {"text": {"text": model_response, "qualifiers": ["guard_content"]}},
            ],
        )
    except (ClientError, BotoCoreError) as exc:
        # Throttling / 5xx / timeout: the guard did NOT pass. Fail closed.
        raise GuardrailBlocked("guardrail unavailable") from exc

    # Authoritative signal: the guardrail decided to intervene.
    if result["action"] == "GUARDRAIL_INTERVENED":
        raise GuardrailBlocked(result.get("actionReason", "intervened"))

    # Defense-in-depth: also enforce our own floor from the returned scores,
    # in case the deployed guardrail config drifts below policy. A MISSING score
    # defaults to 0.0 (fail closed) — never 1.0 — so a partial/absent assessment
    # cannot silently pass this floor.
    for assessment in result.get("assessments", []):
        for f in assessment.get("contextualGroundingPolicy", {}).get("filters", []):
            if f.get("score", 0.0) < GROUNDING_FLOOR:
                raise GuardrailBlocked(f"{f['type'].lower()}_below_floor")

    # Released text is the (possibly PII-masked) content in outputs[]. An empty
    # outputs list means we have no governed text to release — fail closed rather
    # than fall back to the raw (unmasked) model_response.
    outputs = result.get("outputs") or []
    if not outputs:
        raise GuardrailBlocked("no governed output to release")
    return outputs[0]["text"]
```

**Why.** Contextual grounding needs three inputs — `grounding_source`, `query`, and the
content to guard — supplied as content blocks with `qualifiers`. Because a model is not
invoked by `ApplyGuardrail`, the response must be passed explicitly as an extra content
block (optionally qualified `guard_content`), and the check only runs on OUTPUT. The user
prompt is screened separately and earlier by `screen_input` (`source="INPUT"`) for
prompt-injection and PII, before the model is ever called. The
guardrail's authoritative verdict is `action == "GUARDRAIL_INTERVENED"` (the other value is
`"NONE"`); the per-filter `score`/`threshold` are echoed back so the app can also enforce
its own floor. Grounding rejects hallucinated facts not in the source; relevance rejects
correct-but-off-topic answers.

**Security (grounding / PII).** *Grounding:* the pattern is the anti-hallucination gate for
every user-facing generated answer in Weave — a low grounding or relevance score blocks the
response. *PII:* `sensitiveInformationPolicyConfig` masks (`ANONYMIZE`) or blocks (`BLOCK`)
detected entities so PII never reaches the user or logs; released text is read from
`outputs[].text`, not the raw model string. *Fail-closed:* both the `GUARDRAIL_INTERVENED`
branch **and** the `except` branch raise `GuardrailBlocked` — a throttle, 5xx, or timeout
must never fall through to returning ungoverned output. A *missing* grounding `score`
defaults to `0.0` (fail closed), and an empty `outputs` list raises rather than leaking the
raw `model_response`, so config drift or a partial assessment can never silently release
ungoverned text. The `guardrailIdentifier` and any KMS key come from Secrets Manager; the
client runs on an IAM role via STS. *Prompt injection / input PII:* screen the user prompt
with the runnable `screen_input` (`source="INPUT"`) **before** the model call — a required
first-line control, kept separate from the OUTPUT grounding check.

**Anti-patterns.**
- Returning `model_response` in a bare `except` (silent fail-open) — the single worst bug here.
- Treating `action == "NONE"` as the only path and ignoring exceptions.
- Using `guardrailVersion="DRAFT"` in production, or hardcoding the guardrail id.
- Passing the response with `source="INPUT"` (grounding won't run) or omitting the
  `grounding_source` / `query` qualified blocks.
- Setting a threshold of `1` (invalid — blocks everything) or reading released text from the
  raw model string instead of `outputs[].text`.

**Confidence.** High on the runtime shape: `apply_guardrail` params
(`guardrailIdentifier`, `guardrailVersion`, `source` ∈ `INPUT|OUTPUT`, `content`), the
`qualifiers` `grounding_source|query|guard_content`, the response `action` enum
(`NONE|GUARDRAIL_INTERVENED`), `actionReason`, and `assessments[].contextualGroundingPolicy.filters[]`
(`type`, `score`, `threshold`, `detected`, `action`) are quoted from the ApplyGuardrail API
ref and the contextual-grounding user guide. High on the config shape:
`contextualGroundingPolicyConfig.filtersConfig[]` (`type` `GROUNDING`/`RELEVANCE`,
`threshold`, `action`) and `sensitiveInformationPolicyConfig.piiEntitiesConfig[]`
(`type`, `action`) are from the CreateGuardrail API ref. Not confirmed / not run: the
`enabled` field on `filtersConfig[]` is a newer addition — confirm it against the current
CreateGuardrail schema (drop it if the deployed API rejects it). The exact
PII `type` enum member spellings (e.g. `US_SOCIAL_SECURITY_NUMBER`) were not individually
verified against the PII-entity reference; treat those literals as illustrative and confirm
before use. The `source="INPUT"` prompt-attack screen in `screen_input` is required but its
prompt-attack policy config is likewise unverified — confirm before first use. The boto3 method name `create_guardrail`/`apply_guardrail` follows standard
boto3 casing of the documented API operations.
