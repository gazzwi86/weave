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

Use for: regression testing a prompt rewrite, comparing model versions (e.g. Sonnet 4.6
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
  --inference-config '{"models": [{"bedrockModel": {"modelIdentifier": "anthropic.claude-sonnet-4-6", "inferenceParams": "{\"maxTokens\": 1024}"}}]}' \
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
  - id: bedrock:anthropic.claude-sonnet-4-6
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
    modelId="anthropic.claude-sonnet-4-6",
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

*See [`testing-py.md`](testing-py.md) for unit/integration test patterns for agent service code.
Bedrock Guardrails configuration (IDs, versions) lives in AWS Secrets Manager — never hardcoded.*
