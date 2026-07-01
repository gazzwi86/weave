---
type: Coding Standard
title: Agent Testing & Evals — Coding Standard
description: "Testing, evaluation, and monitoring standards for AI agents."
tags: [standards, testing, agents]
timestamp: 2026-06-29T00:00:00Z
resource: docs/standards/testing-agents.md
---

# Agent Testing, Evals & Monitoring

Weave uses AI agents at two levels: **platform agents** (elicitation, generation,
QA — internal to the harness) and **generated agents** (produced by the Build Engine
for clients). Both need evals, hallucination guards, monitoring, and budget control.

All infrastructure is AWS-native where a managed option exists.

## Evaluation tiers

| Tier | When | Tool | Where results land |
|------|------|------|--------------------|
| Offline batch eval | Before merging prompt/model changes | AWS Bedrock Model Evaluation | S3 + CloudWatch |
| CI eval | On every PR touching agent prompts | promptfoo | GitHub Actions |
| Online monitoring | Continuously in staging/prod | CloudWatch + OpenTelemetry | CloudWatch dashboards |

---

## Offline batch evals — AWS Bedrock Model Evaluation

Use for: regression testing a prompt rewrite, comparing model versions (e.g. Sonnet 5
vs Opus 4.8), validating Constitution Engine output quality.

**Dataset format (JSONL, stored in S3):**

```jsonl
{"prompt": "Given this RDF graph: <graph>...\nList all BusinessActors.", "referenceResponse": "weave:Alice\nweave:Bob"}
{"prompt": "Validate this SHACL shape: <shape>...\nDoes it enforce minCount on weave:label?", "referenceResponse": "Yes"}
```

**Trigger via AWS CLI (or Lambda in CI):**

```bash
aws bedrock create-evaluation-job \
  --job-name "constitution-engine-eval-$(date +%Y%m%d)" \
  --role-arn "arn:aws:iam::ACCOUNT:role/WeaveBedrockEvalRole" \
  --evaluation-config '{"automated": {"datasetMetricConfigs": [{"taskType": "QuestionAndAnswer", "dataset": {"name": "weave-qa", "datasetLocation": {"s3Uri": "s3://weave-evals/datasets/constitution-engine.jsonl"}}, "metricNames": ["Accuracy", "BERTScore", "Robustness"]}]}}' \
  --inference-config '{"models": [{"bedrockModel": {"modelIdentifier": "anthropic.claude-sonnet-5", "inferenceParams": "{\"maxTokens\": 1024}"}}]}' \
  --output-data-config '{"s3Uri": "s3://weave-evals/results/"}'
```

**Custom judge (Lambda):** For Weave-specific assertions (e.g. "response contains valid
Turtle syntax"), implement a Lambda judge referenced in `metricNames`:

```python
# lambda/eval_judge.py
import subprocess, json

def handler(event, context):
    response = event["modelResponse"]
    # Validate Turtle syntax using rdflib
    try:
        from rdflib import Graph
        Graph().parse(data=response, format="turtle")
        score = 1.0
    except Exception:
        score = 0.0
    return {"score": score}
```

**Run evals before any model or prompt change that touches Constitution Engine,
Build Engine generation prompts, or the QA agent.** Track scores in CloudWatch
custom metrics (emit from the result processor Lambda).

---

## CI evals — promptfoo

Use for: assertion-style tests on prompt behaviour that run in every PR.
`promptfoo` supports Bedrock natively and integrates with GitHub Actions.

**Install:**

```bash
npm install -D promptfoo
```

**`promptfooconfig.yaml`:**

```yaml
providers:
  - id: bedrock:anthropic.claude-sonnet-5
    config:
      region: ap-southeast-2

prompts:
  - id: constitution-entity-extract
    raw: |
      You are a Weave ontology assistant. Extract all named entities from the
      following text and classify them using ArchiMate 3 layer vocabulary.
      Return valid JSON only.

      TEXT: {{text}}

tests:
  - description: extracts BusinessActor from plain text
    vars:
      text: "Alice manages the billing team at Acme Corp."
    assert:
      - type: is-json
      - type: javascript
        value: |
          JSON.parse(output).some(e => e.type === "BusinessActor")

  - description: does not hallucinate entities not in text
    vars:
      text: "The invoice total is $500."
    assert:
      - type: javascript
        value: |
          const entities = JSON.parse(output);
          !entities.some(e => e.label.toLowerCase().includes("customer"))

  - description: returns valid ArchiMate layer values
    vars:
      text: "Acme uses Salesforce to manage customer relationships."
    assert:
      - type: javascript
        value: |
          const validLayers = ["Strategy","Business","Application","Technology","Physical","Motivation"];
          JSON.parse(output).every(e => validLayers.includes(e.layer))
```

**GitHub Actions step:**

```yaml
- name: Run prompt evals
  env:
    AWS_ROLE_ARN: ${{ secrets.WEAVE_BEDROCK_EVAL_ROLE }}
  run: |
    aws sts assume-role --role-arn $AWS_ROLE_ARN --role-session-name eval | \
      jq -r '.Credentials | "AWS_ACCESS_KEY_ID=\(.AccessKeyId)\nAWS_SECRET_ACCESS_KEY=\(.SecretAccessKey)\nAWS_SESSION_TOKEN=\(.SessionToken)"' >> $GITHUB_ENV
    npx promptfoo eval --config promptfooconfig.yaml --ci
```

**Add `promptfoo eval` to the pre-merge checklist whenever `prompts/` or
`.claude/skills/` files change.**

---

## Hallucination detection

Weave's semantic layer enables stronger hallucination detection than statistical
methods alone.

### Layer 1: Bedrock Guardrails — contextual grounding check

Already in the stack (CLAUDE.md). For RAG-backed responses, Guardrails scores
whether the response is grounded in the retrieved context. Enable on the inference
profile for every agent that reads from the knowledge graph:

```python
import boto3

bedrock = boto3.client("bedrock-runtime", region_name="ap-southeast-2")

response = bedrock.invoke_model(
    modelId="anthropic.claude-sonnet-5",
    guardrailIdentifier="weave-guardrail-id",
    guardrailVersion="DRAFT",
    trace="ENABLED",
    body=json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 1024,
    }),
)
```

Set grounding threshold to **0.75** — below this, the guardrail blocks the response
and returns `GUARDRAIL_INTERVENED`.

### Layer 2: SHACL grounding check (Weave-specific)

After any agent writes triples to the graph, run SHACL validation and a grounding
SPARQL query before committing:

```python
# services/agent_guard.py
from rdflib import Graph
from pyshacl import validate
from app.ontology.store import OntologyStore

def assert_grounded(proposed_triples: str, store: OntologyStore) -> None:
    """Raise if proposed triples assert entities not in the current graph."""
    proposed = Graph().parse(data=proposed_triples, format="turtle")

    # SHACL: structural validity
    conforms, _, report = validate(
        proposed,
        shacl_graph=store.shacl_graph(),
        abort_on_first=False,
    )
    if not conforms:
        raise ValueError(f"SHACL violations in agent output:\n{report}")

    # Grounding: every new subject must either exist in the store or be a
    # blank node / UUID IRI generated in this session
    existing = set(store.subjects())
    for s in proposed.subjects():
        if str(s) not in existing and not str(s).startswith("https://weave.io/instances/"):
            raise ValueError(f"Agent hallucinated non-existent entity: {s}")
```

---

## Monitoring — CloudWatch + OpenTelemetry

Add these to every agent invocation. The ADOT Collector (already in the stack)
ships them to CloudWatch.

### Standard Bedrock metrics (auto-emitted)

| Metric | Alarm threshold |
|--------|----------------|
| `AWS/Bedrock/InvocationLatency` | P99 > 10 s |
| `AWS/Bedrock/InvocationThrottles` | > 5 in 5 min |
| `AWS/Bedrock/InvocationClientErrors` | > 0 |
| `AWS/Bedrock/InputTokenCount` | > 200k / 5 min (cost spike) |

### Weave custom metrics (emit from agent code)

```python
import boto3
from opentelemetry import metrics

meter = metrics.get_meter("weave.agent")

mutations_proposed   = meter.create_counter("weave.agent.mutations_proposed")
shacl_violations     = meter.create_counter("weave.agent.shacl_violations_caught")
guardrail_blocks     = meter.create_counter("weave.agent.guardrail_blocks")
turns_to_complete    = meter.create_histogram("weave.agent.turns_to_complete")
hallucination_blocks = meter.create_counter("weave.agent.hallucination_blocks")
```

Emit after each agent task cycle:

```python
mutations_proposed.add(len(proposed_triples), {"agent": agent_name, "tenant": tenant_id})
turns_to_complete.record(turn_count, {"agent": agent_name})
```

CloudWatch alarms:
- `weave.agent.guardrail_blocks` > 10 / hour → PagerDuty
- `weave.agent.hallucination_blocks` > 0 → Slack alert (always investigate)

---

## Budget control

### 1. Per-invocation token cap (SDK level)

Every agent call sets `max_tokens` explicitly. Never omit it:

```python
# agents/base.py
MAX_TOKENS = {
    "elicitation": 2048,
    "generation":  4096,
    "validation":  1024,
}
```

### 2. Lambda concurrency limit

Cap parallel agent invocations at the Lambda level to bound burst spend:

```hcl
# terraform/modules/agent_lambda/main.tf
resource "aws_lambda_function_event_invoke_config" "agent" {
  function_name          = aws_lambda_function.agent.function_name
  maximum_retry_attempts = 0
}

resource "aws_lambda_provisioned_concurrency_config" "agent" {
  function_name                  = aws_lambda_function.agent.function_name
  qualifier                      = aws_lambda_alias.live.name
  provisioned_concurrent_executions = 5  # hard cap on simultaneous agents
}
```

### 3. AWS Budgets alert

```hcl
resource "aws_budgets_budget" "bedrock_monthly" {
  name         = "weave-bedrock-monthly"
  budget_type  = "COST"
  limit_amount = "500"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  cost_filter {
    name   = "Service"
    values = ["Amazon Bedrock"]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = ["ops@weave.io"]
  }
}
```

### 4. Per-tenant quota (application level)

Store per-tenant token budgets in Aurora. Check before each invocation:

```python
async def check_budget(tenant_id: str, estimated_tokens: int, db: AsyncSession) -> None:
    quota = await db.get(TenantQuota, tenant_id)
    if quota.tokens_used_this_month + estimated_tokens > quota.monthly_limit:
        raise HTTPException(status_code=429, detail="Monthly agent token quota exceeded")
```

---

## Compliance

| Concern | Control |
|---------|---------|
| PII in prompts | Bedrock Guardrails — sensitive information filter (names, emails, phone numbers) |
| Data residency | Bedrock inference stays within the configured AWS region; no cross-region by default |
| Topic blocking | Guardrails topic policy — block off-topic requests (e.g. "generate code unrelated to Weave") |
| Audit trail | All agent invocations log to CloudWatch Logs; PROV-O records every graph mutation |
| Model versioning | Pin `modelId` to a specific version string, never `latest` |

---

## Agent SDK artefact testing

The Build Engine and Events & Actions Engine emit **portable Anthropic Agent SDK artefacts**
(skills, commands, agents) — `pip`-installable, semver-versioned, referenceable as
sub-automations (Events PRD FR-027, E7-S1). These artefacts are generated Python and must
be tested like any other generated code, **as plain functions**, before they are exported
or referenced.

### Unit-test generated skills as plain Python functions

A generated skill is a Python callable. Test it directly — no SDK runtime, no live model,
no network. Construct inputs, call the function, assert on the return value.

```python
# tests/artefacts/test_goods_inward_skill.py
from generated.goods_inward_receipt import summarise_receipt  # generated artefact

def test_summarise_receipt_returns_grounded_fields():
    receipt = {"po_number": "PO-4471", "lines": [{"sku": "A1", "qty": 3}]}
    result = summarise_receipt(receipt)
    assert result["po_number"] == "PO-4471"
    assert result["line_count"] == 1
    # The artefact must not invent fields not present in the input (grounding).
    assert set(result) <= {"po_number", "line_count", "total_qty"}
```

### Mock tool calls at the SDK boundary

Generated artefacts dispatch side effects (Slack, outbound API, graph update) through the
Anthropic Agent SDK tool-dispatch / managed-connector client. **Patch that seam**, never
the artefact's own logic. The artefact then runs as a pure function with no live Slack,
API, or graph side effects.

```python
# tests/artefacts/test_notify_action.py
from unittest.mock import patch
from generated.notify_store_manager import run

def test_notify_dispatches_one_slack_message():
    # Seam = the SDK connector client the generated artefact calls, NOT its logic.
    with patch("generated.notify_store_manager.connectors.slack.post") as slack:
        run({"store_id": "S-12", "message": "Receipt logged"})
    slack.assert_called_once()
    channel = slack.call_args.kwargs["channel"]
    assert channel == "#store-S-12"
```

### Assert idempotency for action artefacts

Action artefacts run under at-least-once delivery (Events PRD E8-S1, FR-029). The artefact
**must be safe to invoke twice with the same `run_id` / idempotency marker** and produce
exactly one side effect — completed steps are SKIPPED on replay, not repeated.

```python
def test_action_is_idempotent_on_redelivery():
    marker_store = InMemoryIdempotencyStore()
    event = {"run_id": "run-abc-123", "store_id": "S-12"}

    with patch("generated.notify_store_manager.connectors.slack.post") as slack:
        run(event, idempotency=marker_store)  # first delivery
        run(event, idempotency=marker_store)  # SQS redelivery, same run_id

    # Exactly one side effect despite two invocations.
    slack.assert_called_once()
```

### Test sub-automation composition

A sub-automation node invokes another automation and maps its input/output (Events PRD
E7-S2, FR-028). Test that mapping is correct and that **cycles are rejected** — an A→B→A
chain must block activation, never run.

```python
def test_sub_automation_maps_output_to_parent_input():
    child = stub_automation(returns={"risk_score": 0.82})
    parent = compose(parent_def, children={"score_step": child})
    out = parent.run({"claim_id": "C-9"})
    assert out["next"]["score"] == 0.82  # child output mapped into parent

def test_sub_automation_cycle_is_rejected_at_validation():
    a = automation_def("A", calls=["B"])
    b = automation_def("B", calls=["A"])  # A -> B -> A
    with pytest.raises(ActivationBlocked, match="sub-automation cycle detected"):
        validate_composition([a, b])
```

---

## Dark-factory agent behaviour tests

The Build Engine dark factory runs agents (Engineer, QA, Architect, Review, Sandbox) under
hard governance invariants (Build PRD Epics 6–7). These are not eval-style quality tests —
they are **deterministic behaviour tests** that assert the safety machinery fires. Each maps
to a PRD acceptance criterion and must be testable, not narrative.

### Sandbox protected-path BLOCK → block + immutable audit entry

A write to a protected path (e.g. `~/.kube/config`) is BLOCKED by the sandbox. The block is
recorded, flagged, and **never deletable** (Build PRD E6-S2, E7-S1; prototype evidence:
`prototypes/Blushift/fixtures.jsx:365` — `op: 'Block', target: '~/.kube/config', meta:
'sandbox BLOCKED • write to protected path • signed ✓', flag:'red'`).

"Immutable" is testable as **append-only / delete-attempt-refused**, not merely "an entry
exists":

```python
def test_protected_path_write_blocks_and_writes_immutable_audit(sandbox, audit):
    with pytest.raises(SandboxBlocked):
        sandbox.write("~/.kube/config", "data")

    entry = audit.latest()
    assert entry.op == "Block"
    assert entry.target == "~/.kube/config"
    assert entry.flag == "red"
    # Immutability is the strong assertion: deletion is refused at the store level.
    with pytest.raises(AuditImmutable):
        audit.delete(entry.n)
```

### Retry-count-to-blocker transition

A task is retried up to its **per-class ceiling** (the four-class taxonomy, Build PRD E6-S3:
infra-flake/transient = 3, logic = 2, interface = 1, spec-ambiguity = 0). On exceeding the
ceiling the task moves to **Blockers & Escalations** with an AI remediation suggestion — it
is never left silently RUNNING. A spec-ambiguity failure routes to **replan**, not retry,
because retrying an ambiguous spec cannot fix it.

```python
def test_logic_failure_becomes_blocker_after_ceiling():
    task = run_task(failure_class="logic")  # ceiling = 2
    assert task.retries == 2
    assert task.state == "blocker"
    assert task.remediation  # AI suggestion attached
    assert task.retry_chip == "retry 2/2"

def test_spec_ambiguity_routes_to_replan_not_retry():
    task = run_task(failure_class="spec-ambiguity")  # ceiling = 0
    assert task.retries == 0
    assert task.state == "replan"  # routed to replan, never retried
```

### HITL-gate pause / approve / reject (no self-approval)

When a HITL gate fires, the task moves to Review and a `PLAT-NOTIFY-1` event fires (Build PRD
E6-S4). The approver must be a **human or higher-authority identity**, and **no agent can
clear a gate its own action triggered** — the dropped invariant most reviewers forget.

```python
def test_hitl_gate_pauses_until_human_decision(factory):
    task = factory.run_to_gate("TASK-024")
    assert task.state == "review"
    assert task.notified  # PLAT-NOTIFY-1 fired

    task.approve(by=human("sarah.chen"))
    assert task.state == "in_progress"

def test_agent_cannot_approve_its_own_gate(factory):
    task = factory.run_to_gate("TASK-024", triggered_by=agent("engineer-1"))
    with pytest.raises(SelfApprovalForbidden):
        task.approve(by=agent("engineer-1"))  # same identity that triggered it

def test_mutating_action_refused_when_audit_unreachable(factory, audit):
    audit.make_unreachable()
    # Fail-closed: the action is refused rather than performed un-audited (E7-S1).
    with pytest.raises(AuditUnavailable):
        factory.run_task("TASK-024")
```

### Mid-flight replan does not re-run completed tasks

A "Replan" instruction (NL + criticality) re-plans remaining work but **must not re-run
tasks already in Done** (Build PRD E6-S4; same skip-completed mechanism as the run engine's
per-step idempotency, Events E8-S1 — "completed steps are SKIPPED").

```python
def test_replan_preserves_completed_tasks(factory):
    factory.complete(["TASK-014", "TASK-015", "TASK-016"])
    factory.run(["TASK-024"])  # in flight

    factory.replan("Tighten checkout validation", criticality="must-fix")

    done = factory.tasks_in_state("done")
    assert {"TASK-014", "TASK-015", "TASK-016"} <= {t.id for t in done}
    # Completed tasks are not re-executed by the replan.
    for t in done:
        assert t.execution_count == 1
```

These behaviour tests gate the same generated code that the generation gates protect — the
**generated-code secret gate** is one of those gates (see
[`secrets-scanning.md`](secrets-scanning.md#generated-code-secret-gate)).

---

*See [`testing-py.md`](testing-py.md) for unit/integration test patterns for agent service code.
Bedrock Guardrails configuration (IDs, versions) lives in AWS Secrets Manager — never hardcoded.*
