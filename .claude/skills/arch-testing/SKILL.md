---
name: arch-testing
description: Produce a testing strategy (testing-strategy.md) for a Weave entity, covering unit, integration, and E2E layers with HITL gates after the unit and integration sections. Invoked by the architect agent during the architect phase.
---

# arch-testing

Produce a testing strategy (`testing-strategy.md`) for a Weave spec entity. All six sections
are written and presented in sequence; HITL Approve/Amend/Reject gates fire after the unit
strategy (Section 2) and again after the integration strategy (Section 3). Invoked by
`/arch-testing` during the architect phase of the Weave SDLC.

## Model

- **Drafting phase:** claude-sonnet-4-6 (structured, precise, stack-aware prose)
- **Complexity review:** claude-sonnet-4-6 (validates mutation thresholds and tool choices)

No Opus tier needed — this is a constrained, stack-opinionated document with no novel
architecture decisions. The Weave stack (pytest, Vitest, Playwright, LocalStack) is fixed.

## Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave confirmed stack, laws (especially Law F: no real cloud in tests)
2. `.claude/spec-templates/tech-spec/testing-strategy.md` — section scaffold
3. `.claude/specs/<entity>/03-arch/tech-spec/tech-spec.md` if present — to understand
   what is being tested (APIs, components, agents, RDF endpoints, pipelines)
4. `.claude/specs/<entity>/02-prd/prd.md` if present — to extract acceptance criteria
   that require E2E coverage
5. `.claude/specs/<entity>/04-arch/tech-spec/stack.md` if present — to confirm whether
   the entity is Python-only, TypeScript-only, or full-stack

Ask the user which entity this testing strategy is for (e.g. `constitution-engine`,
`build-engine`, `weave-platform`) if not supplied. Output path is:
`.claude/specs/<entity>/04-arch/tech-spec/testing-strategy.md`

## Instructions

### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs a testing strategy before writing
anything else.

Example: "A testing strategy's job is to make failure fast and cheap to find. Every layer
of the pyramid exists to catch a different class of defect at the lowest cost. If a test
could be replaced by a lower-level test without losing confidence, it should be."

Reference this principle when justifying tool choices and coverage thresholds during HITL.

### Step 1 — Context ingestion

1. Read existing specs (listed in Input above).
2. Determine the entity's language profile:
   - **Python-only** (e.g. backend API, agent, pipeline) → pytest stack
   - **TypeScript-only** (e.g. frontend SPA, Next.js app) → Vitest + Playwright stack
   - **Full-stack** → both stacks, coordinated via a shared CI matrix
3. Identify whether any AWS services are used (Lambda, S3, Cognito, Aurora, ElastiCache,
   Bedrock, etc.) — each one requires a LocalStack fake in integration tests.
4. Identify whether an RDF store (Oxigraph) is used — requires in-memory Oxigraph instance
   in integration tests, never a shared dev triple store.
5. Identify whether PostgreSQL is used — requires `pytest-postgresql` fixture.
6. Summarise findings in 3 bullets before writing any section:
   - Entity language profile and affected stacks
   - AWS services that need LocalStack coverage
   - Whether UI E2E scenarios can be derived from PRD acceptance criteria

Ask via AskUserQuestion:
- "What context do you have for this entity's test surface?" Options:
  Tech spec + PRD to hand / Tech spec only / PRD only / Start from scratch

### Step 2 — Section-by-section production

Produce the testing strategy in the order defined below. For **every** section:

1. **Write** the section to the file
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated
3. **Present** the section to the user (display the written content)
4. **Emit a confidence block** (see below) immediately after presenting the section

**HITL Approve/Amend/Reject gates fire at two specific checkpoints only:**
- After Section 2 (Unit Test Strategy)
- After Section 3 (Integration Test Strategy)

All other sections are written and presented without a blocking gate. If the user
volunteers feedback on a non-gated section, apply changes immediately before continuing.

Gate procedure (at the two checkpoints):
- Ask via AskUserQuestion: Approve / Amend / Reject
- If Amend: apply changes, show diff, re-present with updated confidence block
- If Reject: regenerate with a cleaner approach, show the new version

---

#### Section 1 — Testing Pyramid Overview

Produce a Mermaid diagram showing the three pyramid layers, annotated with:
- Test type at each layer (unit / integration / E2E)
- Approximate percentage split (60 / 30 / 10)
- Tools at each layer (see stack rules below)
- What class of defect each layer catches

Follow the diagram with a 3-row summary table:

| Layer | Tools | Coverage target | Mutation gate | Run in CI |
|-------|-------|-----------------|---------------|-----------|
| Unit | ... | ≥ 80% | ≥ 70% Stryker/mutmut | Every push |
| Integration | ... | ≥ 80% | ≥ 70% | Every push |
| E2E | ... | Critical paths | N/A | PR merge gate |

Stack rules:
- **Python unit:** `pytest` + `pytest-asyncio` (for async FastAPI handlers)
- **Python mutation:** `mutmut` — threshold ≥ 70%, hard gate at phase completion
- **TypeScript unit:** `Vitest` + `@testing-library/react` for React components
- **TypeScript mutation:** `Stryker` — threshold ≥ 70%
- **E2E (both stacks):** `Playwright` — test against the running app, not mocked pages

Present this section, emit confidence block, then continue to Section 2 without a blocking
gate (unless the user volunteers feedback).

---

#### Section 2 — Unit Test Strategy

Write sub-sections for each applicable language:

**Python unit tests (if entity has a Python layer):**

```
tests/unit/
├── test_<module>.py          # one file per module
└── conftest.py               # shared fixtures
```

- Framework: `pytest` with `pytest-asyncio` for coroutines
- Coverage tool: `pytest-cov` with `--cov-fail-under=80`
- Mutation: `mutmut run` — fail CI if score < 70%
- Naming: `test_<function>_<scenario>_<expected_outcome>`
- Mock strategy: `unittest.mock.patch` / `pytest-mock` for I/O boundaries only —
  never mock business logic
- Async fixtures: use `@pytest.mark.asyncio` and `anyio` backend for FastAPI route handlers

Show a minimal concrete example for a FastAPI handler test using `httpx.AsyncClient`
with `ASGITransport`:

```python
@pytest.mark.asyncio
async def test_create_triple_returns_201_when_valid(client: AsyncClient):
    response = await client.post("/triples", json={"subject": "ex:Foo", ...})
    assert response.status_code == 201
```

**TypeScript unit tests (if entity has a TypeScript/Next.js layer):**

```
src/
└── <feature>/
    └── __tests__/
        ├── <Component>.test.tsx    # React component tests
        └── <util>.test.ts          # Pure logic tests
```

- Framework: `Vitest` with `jsdom` environment for React
- Coverage: `@vitest/coverage-v8` — `--coverage.thresholds.lines=80`
- Mutation: `Stryker` with `@stryker-mutator/vitest-runner` — threshold ≥ 70%
- Naming: `should <expected behaviour> when <condition>`
- Mock strategy: `vi.mock()` for module boundaries; `msw` for HTTP; never mock component
  rendering or pure functions

Show a minimal concrete example using `@testing-library/react`:

```typescript
it('should render error state when fetch fails', async () => {
  server.use(http.get('/api/triples', () => HttpResponse.error()));
  render(<TripleList />);
  expect(await screen.findByText(/failed to load/i)).toBeInTheDocument();
});
```

**AC-to-test mapping table** — map each PRD acceptance criterion to at least one unit test
scenario. Use EARS notation: `WHEN [event] THEN THE SYSTEM SHALL [behaviour]`.

| AC ID | EARS scenario | Test file | Test name |
|-------|---------------|-----------|-----------|
| AC-1 | WHEN a user submits a valid triple THEN THE SYSTEM SHALL persist it and return HTTP 201 | `test_triples.py` | `test_create_triple_returns_201_when_valid` |

If PRD ACs are not available, leave placeholder rows and note: "Populate when PRD ACs
confirmed."

**HITL gate — present this section and await Approve / Amend / Reject before continuing.**

---

#### Section 3 — Integration Test Strategy

Integration tests verify contracts between components. They run against real (faked)
infrastructure — never against real cloud accounts (Law F).

**Infrastructure fakes:**

Weave uses LocalStack as the primary AWS service fake. Testcontainers (`testcontainers-python`)
is acceptable for spinning up Docker-based services (e.g. a real Oxigraph container for
heavy SPARQL integration tests) when in-memory fakes are insufficient — but it must never
start a real AWS endpoint.

| Service | Dev/test fake | How to start |
|---------|---------------|--------------|
| AWS Lambda / S3 / SQS / Cognito / Aurora | LocalStack via Docker Compose | `docker compose up localstack` |
| Oxigraph (RDF store) | `oxigraph` Python package, in-memory mode (default); Testcontainers image for full SPARQL compliance tests | `Store()` fixture or Testcontainers |
| PostgreSQL | `pytest-postgresql` fixture | Auto-provisioned per test session |
| Redis (ElastiCache) | `fakeredis` | `fakeredis.FakeRedis()` fixture |

**Directory layout:**

```
tests/integration/
├── conftest.py           # LocalStack + DB fixtures
├── test_<boundary>.py    # one file per integration boundary
└── docker-compose.test.yml
```

**Fixture pattern for LocalStack:**

```python
@pytest.fixture(scope="session")
def localstack_endpoint():
    return os.getenv("LOCALSTACK_ENDPOINT", "http://localhost:4566")

@pytest.fixture
def s3_client(localstack_endpoint):
    return boto3.client("s3", endpoint_url=localstack_endpoint,
                        aws_access_key_id="test", aws_secret_access_key="test",
                        region_name="us-east-1")
```

**Oxigraph in-memory fixture:**

```python
@pytest.fixture
def rdf_store():
    from pyoxigraph import Store
    return Store()  # ephemeral; destroyed after test
```

**Coverage and mutation targets:**
- Integration tests contribute to the shared ≥ 80% line coverage target
- Mutation testing does not apply to integration tests (infrastructure fakes introduce
  non-determinism that breaks mutant detection)

**What integration tests MUST cover:**
- All SPARQL query/update paths through the RDF store
- All REST API endpoints that touch a database or external service
- All Strands agent tool invocations against faked AWS services
- All SHACL validation paths

**What integration tests must NOT do:**
- Call real AWS endpoints (no real credentials, no real region endpoints)
- Share state between tests (each test gets its own ephemeral fixtures)
- Test UI rendering (that belongs in unit or E2E)

**HITL gate — present this section and await Approve / Amend / Reject before continuing.**

---

#### Section 4 — E2E Test Strategy

E2E tests verify complete user journeys through the deployed stack. Run against a locally
started application or a staging environment — never production.

**Framework:** Playwright (TypeScript)

**Directory layout:**

```
tests/e2e/
├── playwright.config.ts
├── fixtures/
│   └── auth.fixture.ts       # re-usable authenticated page fixture
├── <feature>.spec.ts         # one file per feature area
└── helpers/
    └── test-data.ts          # seed helpers
```

**Playwright configuration principles:**
- Use `baseURL` from env var (`TEST_BASE_URL`, default `http://localhost:3000`)
- Run in CI with `--reporter=html` stored as artifact
- Parallelism: `workers: process.env.CI ? 1 : 4` (serial in CI to avoid port conflicts)
- Screenshots and video on failure only

**Coverage scope — derive from PRD ACs:**
For each acceptance criterion in the PRD that involves a user action visible in the UI,
produce a Playwright scenario in EARS notation:

| AC ID | EARS scenario | Spec file | Status |
|-------|---------------|-----------|--------|
| AC-1 | WHEN a user submits a valid ontology triple THEN THE SYSTEM SHALL persist it and display it in the graph explorer within 2 seconds | `triple-create.spec.ts` | Planned |

Minimum E2E scenarios (always required regardless of entity):
- Happy path: primary user journey end-to-end
- Auth guard: unauthenticated user redirected to login
- Error state: backend returns 500, UI shows graceful error

**Run command:**

```bash
npx playwright test --project=chromium
```

**CI gate:** E2E tests run on the PR merge gate only (not every push) to keep push
feedback fast.

---

#### Section 5 — Test Data Management

Test data strategy depends on the layer:

| Layer | Strategy | Rationale |
|-------|----------|-----------|
| Unit | Inline fixtures / factory functions | Fast, deterministic, no I/O |
| Integration | pytest fixtures + ephemeral Docker volumes | Isolated per-session |
| E2E | Playwright `beforeAll` seed scripts | Reproducible starting state |

**Python factory pattern:**

```python
def make_triple(subject="ex:Foo", predicate="rdf:type", obj="ex:Bar"):
    return Triple(subject=subject, predicate=predicate, object=obj)
```

**TypeScript factory pattern:**

```typescript
export const makeUser = (overrides: Partial<User> = {}): User => ({
  id: crypto.randomUUID(),
  email: "test@example.com",
  role: "viewer",
  ...overrides,
});
```

**Prohibited patterns:**
- Shared mutable test databases (each test must own its data)
- Hardcoded UUIDs or IDs (use factories or `uuid4()`)
- Production data snapshots (use synthetic data only — Law F)
- Secrets or PII in test fixtures (use fake values, e.g. `faker`)

---

#### Section 6 — Performance and Load Testing

Apply this section only if the entity exposes public API endpoints or serves a UI.
If the entity is a pure background pipeline with no latency SLAs, mark this section
"N/A — internal pipeline" and skip.

**API performance targets (default — adjust per entity SLA):**

| Endpoint pattern | Method | P50 target | P95 target | P99 target |
|-----------------|--------|-----------|-----------|-----------|
| `/api/triples` | GET | < 100ms | < 300ms | < 500ms |
| `/api/triples` | POST | < 200ms | < 500ms | < 1000ms |
| SPARQL query (`/sparql`) | POST | < 500ms | < 1500ms | < 3000ms |

**Load test tool:** `locust` (Python) for API load testing. Run in CI only on the
`performance` workflow (not the standard push pipeline).

```python
class WeaveUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def get_triples(self):
        self.client.get("/api/triples")
```

**Lighthouse targets (UI only):**

| Metric | Target |
|--------|--------|
| Performance score | ≥ 90 |
| Accessibility score | ≥ 95 |
| Best practices score | ≥ 90 |
| Initial JS bundle (gzipped) | ≤ 200KB |

**When to run:**
- API load tests: weekly scheduled run + any PR touching a hot-path endpoint
- Lighthouse: every PR that modifies a page component or layout

---

### Step 3 — Final review and commit

After all sections are approved:

1. Verify no `{{PLACEHOLDER}}` text remains in the output file.
2. Verify all Mermaid diagrams are syntactically correct (check for unclosed blocks).
3. Verify all code examples use the Weave stack (pytest, Vitest, Playwright, LocalStack).
4. Commit:

```bash
git add .claude/specs/<entity>/04-arch/tech-spec/testing-strategy.md
git commit -m "docs(<entity>): add testing strategy"
```

Tell the user: "Testing strategy complete. Next step: `/arch-task-brief` to produce task
briefs that reference this strategy, or `/qa` to validate the spec."

## Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
Testing Law 1 (pytest for Python): complied | violated | N/A — <reason>
Testing Law 2 (Vitest+Playwright for TS): complied | violated | N/A — <reason>
Testing Law 3 (LocalStack not real AWS): complied | violated | N/A — <reason>
Testing Law 4 (mutation gate ≥ 70%): complied | violated | N/A — <reason>
Testing Law 5 (coverage ≥ 80%): complied | violated | N/A — <reason>
Testing Law 6 (HITL gate after Section 2 unit AND Section 3 integration, not other sections): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

## Confidence block (emit before every HITL question)

Output this block immediately after presenting the section, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific bullet, sentence, or table row>
Why: <1 sentence — what input was missing or what you assumed>
</section-confidence>
```

Rules:
- Always name the weakest part, even on high-confidence sections.
- "Why" must reference a specific input gap. "The future is uncertain" is not acceptable.
- The block lives in chat only — do not embed it in the file.

## Output

File: `.claude/specs/<entity>/04-arch/tech-spec/testing-strategy.md`

Template: `.claude/spec-templates/tech-spec/testing-strategy.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.

Frontmatter:

```yaml
---
title: "Testing Strategy: <entity display name>"
status: Draft
created: <YYYY-MM-DD>
entity: <entity>
phase: 04-arch
---
```

## Evaluation Criteria

A well-produced testing strategy:

- Contains a Mermaid pyramid diagram annotated with tools, percentages, and defect classes
  at every layer
- Uses the correct stack per language: pytest + pytest-asyncio (Python), Vitest + Playwright
  (TypeScript) — never Jest, never unittest alone
- Specifies LocalStack (or Testcontainers) for every AWS/infrastructure fake — no real
  cloud credentials anywhere
- States mutation gate of ≥ 70% (mutmut for Python, Stryker for TS) and coverage floor of
  ≥ 80% both enforced in CI
- Has an AC-to-test mapping table with EARS notation (`WHEN ... THEN THE SYSTEM SHALL ...`)
  for every mapped criterion
- Shows concrete, runnable code examples for at least one unit test and one integration
  fixture
- Has HITL Approve/Amend/Reject gates exactly at Section 2 and Section 3, constitutional
  self-check trace in chat at every section, and no `{{PLACEHOLDER}}` text
- Sections 4-6 are presented with confidence blocks and absorb volunteer feedback but do
  not block on a gate
