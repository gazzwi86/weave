---
name: arch-quality
description: Produce testing-strategy.md (unit/integration/E2E, HITL gates after unit & integration sections), definition-of-done.md (mechanically-verifiable DoD checklist), and definition-of-ready.md (task-start readiness gate) for a Weave entity. Invoked by the architect agent during the tech-spec phase for testing strategy and DoD (typically after the tech spec is drafted), and by the architect agent or the implement skill for DoR (gates task creation / task start).
---

# arch-quality Skill

Produces the three quality-gate artifacts for a Weave spec entity: a testing strategy, a
Definition of Done, and a Definition of Ready. Testing strategy and DoD are entity-scoped and
run during the architect phase, typically after the tech spec is drafted. DoR is task-scoped —
invoked by the `implement` skill before a task starts, or by the architect agent to gate task
creation.

Each part below is a self-contained sub-skill: it reads its own inputs, produces its own output
file, runs its own constitutional self-check and HITL gate(s), and commits separately. Run the
part the invocation asks for.

## Model

**Mid tier** for all three parts — structured, precise, stack-aware generation against
well-defined inputs (tech spec, PRD, task brief). None of the three artifacts require open-ended
elicitation or novel architectural judgement, so no high-tier escalation applies.

---

## Part 1: Testing Strategy

Produce a testing strategy (`testing-strategy.md`) for a Weave spec entity. All six sections are
written and presented in sequence; HITL Approve/Amend/Reject gates fire after the unit strategy
(Section 2) and again after the integration strategy (Section 3).

### Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave confirmed stack, laws (especially Law F: no real cloud in tests)
2. `.claude/spec-templates/tech-spec/testing-strategy.md` — section scaffold
3. `docs/specs/weave/engines/<entity>/tech-spec/architecture.md` if present — to understand
   what is being tested (APIs, components, agents, RDF endpoints, pipelines)
4. `docs/specs/weave/engines/<entity>.md` if present — to extract acceptance criteria
   that require E2E coverage
5. `docs/specs/weave/engines/<entity>/tech-spec/stack.md` if present — to confirm whether
   the entity is Python-only, TypeScript-only, or full-stack

Ask the user which entity this testing strategy is for (e.g. `constitution-engine`,
`build-engine`, `weave-platform`) if not supplied. Output path is:
`docs/specs/weave/engines/<entity>/tech-spec/testing-strategy.md`

### Instructions

#### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs a testing strategy before writing
anything else.

Example: "A testing strategy's job is to make failure fast and cheap to find. Every layer
of the pyramid exists to catch a different class of defect at the lowest cost. If a test
could be replaced by a lower-level test without losing confidence, it should be."

Reference this principle when justifying tool choices and coverage thresholds during HITL.

#### Step 1 — Context ingestion

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

#### Step 2 — Section-by-section production

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

##### Section 1 — Testing Pyramid Overview

Produce a Mermaid diagram showing the three pyramid layers, annotated with:
- Test type at each layer (unit / integration / E2E)
- Approximate percentage split (60 / 30 / 10)
- Tools at each layer (see stack rules below)
- What class of defect each layer catches

Follow the diagram with a 3-row summary table:

| Layer | Tools | Coverage target | Mutation gate | Run in CI |
|-------|-------|-----------------|---------------|-----------|
| Unit | ... | ≥ 80% | ≥ 60% Stryker/mutmut | Every push |
| Integration | ... | ≥ 80% | ≥ 60% | Every push |
| E2E | ... | Critical paths | N/A | PR merge gate |

Stack rules:
- **Python unit:** `pytest` + `pytest-asyncio` (for async FastAPI handlers)
- **Python mutation:** `mutmut` — threshold ≥ 60%, hard gate at phase completion
- **TypeScript unit:** `Vitest` + `@testing-library/react` for React components
- **TypeScript mutation:** `Stryker` — threshold ≥ 60%
- **E2E (both stacks):** `Playwright` — test against the running app, not mocked pages

Present this section, emit confidence block, then continue to Section 2 without a blocking
gate (unless the user volunteers feedback).

---

##### Section 2 — Unit Test Strategy

Write sub-sections for each applicable language:

**Python unit tests (if entity has a Python layer):**

```text
tests/unit/
├── test_<module>.py          # one file per module
└── conftest.py               # shared fixtures
```

- Framework: `pytest` with `pytest-asyncio` for coroutines
- Coverage tool: `pytest-cov` with `--cov-fail-under=80`
- Mutation: `mutmut run` — fail CI if score < 60%
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

```text
src/
└── <feature>/
    └── __tests__/
        ├── <Component>.test.tsx    # React component tests
        └── <util>.test.ts          # Pure logic tests
```

- Framework: `Vitest` with `jsdom` environment for React
- Coverage: `@vitest/coverage-v8` — `--coverage.thresholds.lines=80`
- Mutation: `Stryker` with `@stryker-mutator/vitest-runner` — threshold ≥ 60%
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

##### Section 3 — Integration Test Strategy

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

```text
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
- All Anthropic Agent SDK agent tool invocations against faked AWS services
- All SHACL validation paths

**What integration tests must NOT do:**
- Call real AWS endpoints (no real credentials, no real region endpoints)
- Share state between tests (each test gets its own ephemeral fixtures)
- Test UI rendering (that belongs in unit or E2E)

**HITL gate — present this section and await Approve / Amend / Reject before continuing.**

---

##### Section 4 — E2E Test Strategy

E2E tests verify complete user journeys through the deployed stack. Run against a locally
started application or a staging environment — never production.

**Framework:** Playwright (TypeScript)

**Directory layout:**

```text
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

##### Section 5 — Test Data Management

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

##### Section 6 — Performance and Load Testing

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

#### Step 3 — Final review and commit

After all sections are approved:

1. Verify no `{{PLACEHOLDER}}` text remains in the output file.
2. Verify all Mermaid diagrams are syntactically correct (check for unclosed blocks).
3. Verify all code examples use the Weave stack (pytest, Vitest, Playwright, LocalStack).
4. Commit:

```bash
git add docs/specs/weave/engines/<entity>/tech-spec/testing-strategy.md
git commit -m "docs(<entity>): add testing strategy"
```

Tell the user: "Testing strategy complete. Next step: `/arch-task-brief` to produce task
briefs that reference this strategy, or `/qa` to validate the spec."

### Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```text
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
Testing Law 1 (pytest for Python): complied | violated | N/A — <reason>
Testing Law 2 (Vitest+Playwright for TS): complied | violated | N/A — <reason>
Testing Law 3 (LocalStack not real AWS): complied | violated | N/A — <reason>
Testing Law 4 (mutation gate ≥ 60%): complied | violated | N/A — <reason>
Testing Law 5 (coverage ≥ 80%): complied | violated | N/A — <reason>
Testing Law 6 (HITL gate after Section 2 unit AND Section 3 integration, not other sections): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

### Confidence block (emit before every HITL question)

Output this block immediately after presenting the section, before the AskUserQuestion call:

```text
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

### Output

File: `docs/specs/weave/engines/<entity>/tech-spec/testing-strategy.md`

Template: `.claude/spec-templates/tech-spec/testing-strategy.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.

Frontmatter:

```yaml
---
type: Testing Strategy
title: "Testing Strategy: <entity display name>"
description: "<one-line summary of the testing strategy for this entity>"
tags: [<entity>, arch]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: Draft
created: <YYYY-MM-DD>
entity: <entity>
phase: arch
---
```

### Evaluation Criteria

A well-produced testing strategy:

- Contains a Mermaid pyramid diagram annotated with tools, percentages, and defect classes
  at every layer
- Uses the correct stack per language: pytest + pytest-asyncio (Python), Vitest + Playwright
  (TypeScript) — never Jest, never unittest alone
- Specifies LocalStack (or Testcontainers) for every AWS/infrastructure fake — no real
  cloud credentials anywhere
- States mutation gate of ≥ 60% (mutmut for Python, Stryker for TS) and coverage floor of
  ≥ 80% both enforced in CI
- Has an AC-to-test mapping table with EARS notation (`WHEN ... THEN THE SYSTEM SHALL ...`)
  for every mapped criterion
- Shows concrete, runnable code examples for at least one unit test and one integration
  fixture
- Has HITL Approve/Amend/Reject gates exactly at Section 2 and Section 3, constitutional
  self-check trace in chat at every section, and no `{{PLACEHOLDER}}` text
- Sections 4-6 are presented with confidence blocks and absorb volunteer feedback but do
  not block on a gate

---

## Part 2: Definition of Done

Produce a precise, QA-verifiable Definition of Done checklist (`definition-of-done.md`) for a
Weave tech spec entity. Every item in the checklist must be mechanically verifiable — no vague
criteria.

### Input

Before doing anything else, read:

1. `/Users/gareth/Sites/weave/CLAUDE.md` — Weave laws, complexity thresholds, confirmed stack
2. `.claude/spec-templates/tech-spec/definition-of-done.md` — canonical section scaffold
3. `docs/specs/weave/engines/<entity>/tech-spec/architecture.md` (if present) — entity-specific
   acceptance criteria and architectural constraints to incorporate into the DoD
4. `docs/specs/weave/engines/<entity>.md` (if present) — user stories and ACs that must be
   reflected in the Testing section

Ask the user which entity this DoD is for (e.g. `constitution-engine`, `build-engine`,
`weave-platform`) if not supplied. Output path is:

```text
docs/specs/weave/engines/<entity>/tech-spec/definition-of-done.md
```

### Instructions

#### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs a Definition of Done before writing
anything else.

Example: "A DoD item that cannot be checked by a script or a reviewer in under 60 seconds is
not a DoD item — it is a wish. Every item in this checklist must have a named tool, metric, or
binary signal that proves compliance. Ambiguity in a DoD becomes ambiguity in a PR review."

Reference this principle when justifying decisions during the HITL loop.

#### Step 1 — Context ingestion

1. Read the files listed in the Input section above.
2. Extract the entity name, its confirmed tech stack components, and any acceptance criteria
   already captured in the tech spec or PRD.
3. Note any entity-specific complexity, security, or testing constraints that should supplement
   the standard template items.
4. Summarise what you know in 3 bullets before proceeding:
   - What the entity is and which phase it is in
   - Which Weave stack components it touches (backend, frontend, RDF store, etc.)
   - Any entity-specific constraints or ACs that will extend the standard checklist

#### Step 2 — Produce the full DoD checklist

Produce all five sections in a single pass (this is a mechanical artifact — section-by-section
HITL would add no value for a checklist). Write every item using this rule:

**Each item must be:**
- Expressed as a binary pass/fail check
- Verifiable by a named tool, metric, or explicit criterion
- Free of adjectives like "good", "clean", "appropriate", or "sufficient" without a number

Use the template scaffold from `.claude/spec-templates/tech-spec/definition-of-done.md` as the
base. Extend with entity-specific items derived from Step 1.

##### Section A — Code Quality

Mandatory items (always include, verbatim thresholds from `CLAUDE.md`):

- [ ] ESLint passes with zero errors and zero warnings (frontend TypeScript)
- [ ] Ruff passes with zero violations (backend Python)
- [ ] Cyclomatic complexity ≤ 10 per function (checked via Radon for Python, ESLint
      complexity rule for TypeScript)
- [ ] Cognitive complexity ≤ 15 per function (Radon for Python, SonarJS for TypeScript)
- [ ] No function exceeds 50 lines (Radon for Python, ESLint max-lines-per-function for
      TypeScript)
- [ ] No `TODO`, `FIXME`, or `HACK` comments left unresolved
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI enforced)
- [ ] All public API functions and components have JSDoc (TypeScript) or docstrings (Python)

##### Section B — Testing

Mandatory items:

- [ ] All acceptance criteria from the tech spec are covered by at least one automated test
- [ ] Unit test coverage ≥ 80% for all changed modules (measured via pytest-cov / Vitest
      coverage)
- [ ] Mutation score ≥ 60% for changed modules (measured via mutmut for Python, Stryker for
      TypeScript)
- [ ] Integration tests pass against LocalStack (AWS services) or Oxigraph test instance
      (RDF store) — no real cloud calls in test suite
- [ ] E2E tests pass via Playwright for any user-facing flows introduced
- [ ] No flaky tests introduced (CI green on three consecutive runs)
- [ ] Edge cases identified in QA review are covered

##### Section C — Documentation

Mandatory items:

- [ ] JSDoc on all new or modified public TypeScript functions and components
- [ ] Docstrings (Google style) on all new or modified public Python functions and classes
- [ ] OpenAPI spec updated for any new or modified REST endpoints
      (`docs/specs/weave/engines/<entity>/tech-spec/openapi.yaml`)
- [ ] SPARQL queries documented inline with a comment explaining intent
- [ ] ADR created in `docs/specs/weave/engines/<entity>/decisions/` if an architectural decision was made
- [ ] README or relevant wiki page updated if user-facing behaviour changed

##### Section D — Git Hygiene

Mandatory items:

- [ ] All commits follow conventional commit format (`feat:`, `fix:`, `docs:`, `test:`,
      `chore:`) — verified by commitlint
- [ ] Each commit is a logical, atomic unit of work (no "WIP" or "misc" commits)
- [ ] PR description references the task ID and links to the tech spec entity
- [ ] PR is scoped to a single phase (stacked PRs — one PR per phase per Plugin Law D)
- [ ] PR is reviewable: diff ≤ 400 lines of changed application code (excluding generated
      files and lock files)

##### Section E — Security

Mandatory items:

- [ ] No secrets, API keys, tokens, or passwords hardcoded in source files or committed to git
- [ ] No `.env` files committed — secrets sourced from AWS Secrets Manager only
- [ ] SAST scan passes (Bandit for Python, eslint-plugin-security for TypeScript) with zero
      high-severity findings
- [ ] All SQL queries use parameterised form — no string concatenation with user input
      (SQLAlchemy ORM or explicit parameterised queries)
- [ ] User input validated and sanitised at system boundaries via Pydantic v2 models
      (backend) or Zod schemas (frontend)
- [ ] No `eval()`, `Function()`, or dynamic code execution in frontend TypeScript

#### Step 3 — Run constitutional self-check

Run the full constitutional self-check (see below) before presenting output. If any Law is
violated, revise the relevant section and re-run the check.

#### Step 4 — Present and single HITL gate

Display the complete checklist to the user. Emit the confidence block immediately after.
Then ask via AskUserQuestion: **Approve / Amend / Reject**

- If **Approve**: proceed to Step 5.
- If **Amend**: apply the requested changes, show a diff of changed items, re-present with
  updated confidence block, ask again.
- If **Reject**: regenerate the checklist from scratch with a different approach, show the
  new version.

#### Step 5 — Write output file

Write the approved checklist to:

```text
docs/specs/weave/engines/<entity>/tech-spec/definition-of-done.md
```

Create the directory if it does not exist.

#### Step 6 — Commit

```bash
git add docs/specs/weave/engines/<entity>/tech-spec/definition-of-done.md
git commit -m "docs(<entity>): add definition of done for tech spec"
```

Then tell the user: "DoD complete. QA can now run `/qa` against this checklist, or continue
with `/architect` to proceed to the next tech spec artifact."

### Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```text
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
DoD Law 1 (every item binary pass/fail): complied | violated | N/A — <reason>
DoD Law 2 (named tool or metric per item): complied | violated | N/A — <reason>
DoD Law 3 (no vague adjectives without numbers): complied | violated | N/A — <reason>
DoD Law 4 (CLAUDE.md thresholds baked in): complied | violated | N/A — <reason>
DoD Law 5 (security items cover Weave security.md rules): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the affected items, re-run the check.

Output the trace in chat (user sees it). Keeps Laws active across long sessions.

### Confidence block (emit before the single HITL question)

Output this block immediately after presenting the checklist, before the AskUserQuestion call:

```text
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific item or section>
Why: <1 sentence — what input was missing or what you assumed>
</section-confidence>
```

Rules:

- Always name the weakest part, even on high-confidence output.
- "Why" must reference a specific input gap. "The future is uncertain" is not acceptable.
- The block lives in chat only — do not embed it in the file.

### Output

File: `docs/specs/weave/engines/<entity>/tech-spec/definition-of-done.md`

Template: `.claude/spec-templates/tech-spec/definition-of-done.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.

Frontmatter:

```yaml
---
type: Definition of Done
title: "Definition of Done: <entity display name>"
description: "<one-line summary of the mechanically-verifiable DoD for this entity>"
tags: [<entity>, arch]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: Draft
created: <YYYY-MM-DD>
entity: <entity>
phase: arch
---
```

### Evaluation Criteria

A well-produced Definition of Done:

- Contains only binary pass/fail items — no item uses "good", "appropriate", "sufficient", or
  similar unmeasurable adjectives without an accompanying number or tool name
- References exact complexity thresholds from `CLAUDE.md`: cyclomatic ≤ 10, cognitive ≤ 15,
  function length ≤ 50 lines
- Names the specific tool or command that verifies each item (e.g. Radon, pytest-cov, Bandit,
  commitlint, Playwright) — no item says "verify manually" without a defined procedure
- Coverage items specify ≥ 80% unit coverage and ≥ 60% mutation score
- Security section covers all five rules in `.claude/rules/security.md`
- Git hygiene section enforces Plugin Law D (stacked PRs, one per phase)
- LocalStack / Oxigraph called out explicitly in integration tests — no real cloud calls
- Has no `{{PLACEHOLDER}}` text and was written by the mid-tier model (precision tier)

---

## Part 3: Definition of Ready

Produce a Definition of Ready (`definition-of-ready.md`) checklist for a Weave task brief,
verifying every prerequisite the Engineer needs before starting implementation.

### Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave laws, confirmed stack, spec path conventions
2. `.claude/spec-templates/tech-spec/definition-of-ready.md` — canonical DoR checklist
   structure (use as scaffold; never leave `{{}}` in output)
3. `.claude/spec-templates/task.md` — task brief schema (maps directly to DoR items)
4. The target task brief: `docs/specs/weave/engines/<entity>/<milestone>/tasks/<TASK_ID>.md`
5. Any existing DoR for this task (`docs/specs/weave/engines/<entity>/tech-spec/definition-of-ready.md`)
   to continue or refresh

Ask the user which entity and task ID this DoR is for if not supplied. Confirm the output path:

```text
docs/specs/weave/engines/<entity>/tech-spec/definition-of-ready.md
```

### Instructions

#### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle before doing anything else.

Example: "A Definition of Ready exists to protect the Engineer from ambiguity. If the
Engineer must guess any decision that is in scope for the Architect to have made, the
task is not ready. Every unchecked item is a scope-creep vector or a blocked day."

Reference this principle when justifying any FAIL rating during the HITL loop.

#### Step 1 — Context ingestion

1. Read the target task brief (listed in Input above).
2. Read the DoR template to internalise section structure.
3. Summarise in 3 bullets before producing the checklist:
   - What the task does (from the Story section of the brief)
   - Which DoR sections are clearly satisfied (based on a quick scan)
   - Which DoR sections look thin or absent (flag as risk)

No user question needed here — proceed directly to Step 2 unless entity/task ID is missing.

#### Step 2 — Section-by-section checklist production

Produce the DoR in the exact section order below. For each section:

1. **Evaluate** each checklist item against the task brief — PASS or FAIL with a one-line
   reason for every FAIL.
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated.
3. **Write** the section to the output file.
4. Accumulate all sections; do NOT present section-by-section to the user.

**Sections in order:**

##### Section 1 — Task Brief Completeness

Map directly to the `task.md` schema. Evaluate:

- [ ] User story present in "As a / I want / So that" format
- [ ] Acceptance criteria table populated (each row has ID, criteria, test mapping)
- [ ] Each AC uses EARS format: `WHEN [event] THE SYSTEM SHALL [behaviour]` or
  Given/When/Then with observable outcomes (status code, response shape, header)
- [ ] Pseudocode or implementation approach provided (not just a description — actual
  algorithmic steps, input guards, error shapes)
- [ ] API contracts defined where the task touches an HTTP endpoint:
  - Method + path
  - Request schema (JSON example)
  - Response schema per status code (200, 4xx at minimum)
- [ ] No `{{PLACEHOLDER}}` text remaining in the brief

For each FAIL item, record the exact field or row that is missing or incomplete.

##### Section 2 — Dependencies Identified

- [ ] `blocked_by` field is present and either lists task IDs or is explicitly `[]`
- [ ] `unlocks` field is present and either lists task IDs or is explicitly `[]`
- [ ] For each task in `blocked_by`: a dependency summary exists at
  `.claude/state/summaries/<DEP_TASK_ID>.md` OR this is documented as pending
- [ ] No circular dependencies (check the graph: a task in `blocked_by` must not
  eventually list this task in its own `blocked_by`)

##### Section 3 — Diagrams Referenced

- [ ] Diagram references table is populated (not blank)
- [ ] Each row has: diagram type, file path relative to the spec tree, and a 1-line summary
- [ ] Required diagram types are covered (mark N/A only if the task type genuinely excludes it):
  - Sequence diagram — present or N/A (stateless utility only)
  - State diagram — present or N/A (no state machine in scope)
  - Data model / ERD — present or N/A (no persistence in scope)
- [ ] Each referenced file exists on disk (run `ls` to verify)

##### Section 4 — Design Decisions Noted

- [ ] Design decisions table is populated (not blank)
- [ ] Each row has: decision text, ADR reference, and impact on this task
- [ ] Every ADR reference points to a file that exists:
  `docs/specs/weave/engines/<entity>/decisions/ADR-NNN.md`
- [ ] Decisions that affect Weave's confirmed stack (FastAPI, Next.js 15, Oxigraph,
  AWS Bedrock, etc.) are cross-referenced to `CLAUDE.md` rather than re-stated

##### Section 5 — Test Scenarios Specified

- [ ] Unit test list is present with minimum count stated (`minimum N`)
- [ ] Integration test list is present with minimum count stated (`minimum N`)
- [ ] E2E test list is present with minimum count stated (may be 0 for backend-only tasks)
- [ ] Each test name follows the pattern: `should <expected behaviour> when <condition>`
- [ ] AC-to-test mapping table is populated — every AC ID appears at least once
- [ ] Edge cases identified (at least one per AC, or explicitly stated as none)
- [ ] Playwright specified for any test that exercises browser behaviour (Law B enforcement)

##### Section 6 — Cost Estimate Provided

- [ ] Complexity field is one of: S / M / L / XL
- [ ] Estimated token counts provided (input K + output K)
- [ ] Estimated cost in USD provided
- [ ] Complexity rating is consistent with the pseudocode size and AC count:
  - S = ≤ 3 ACs, single function, no persistence
  - M = 4-6 ACs, 2-3 functions, one persistence layer
  - L = 7-10 ACs, multi-layer, multi-service
  - XL = > 10 ACs or architectural change

#### Step 3 — Aggregate result and overall readiness verdict

After all six sections are evaluated, produce an overall readiness verdict:

```text
## Overall Readiness

Status: READY | NOT READY
Failed items: N
Blocking items: <list section + item for each FAIL>
```

Rules:
- Status is READY only if zero items are FAIL.
- A single FAIL in any section makes the whole task NOT READY.
- Do not adjust thresholds based on urgency or team preference.

#### Step 4 — Single HITL presentation

Present the **complete checklist** (all six sections + overall verdict) to the user in one
block. Do not drip-feed sections.

Emit the confidence block immediately after the checklist, before the AskUserQuestion call:

```text
<section-confidence>
Confidence: high | medium | low
Weakest part: <section name + specific item>
Why: <1 sentence — what was missing from the task brief or assumed>
</section-confidence>
```

Then ask via AskUserQuestion: **Approve / Amend / Reject**

- **Approve** — checklist is accurate, write the file, call `progress.sh phase-check`,
  proceed to commit.
- **Amend** — user corrects specific items (e.g. marks a FAIL as intentionally deferred,
  or adds missing content to the task brief). Apply changes, show diff, re-emit confidence
  block, re-ask.
- **Reject** — regenerate cleanly from the task brief without assumptions.

#### Step 5 — Write file and update progress

1. Write the DoR to:
   `docs/specs/weave/engines/<entity>/tech-spec/definition-of-ready.md`

2. Run:

   ```bash
   .claude/scripts/progress.sh phase-check
   ```

3. Commit:

   ```bash
   git add docs/specs/weave/engines/<entity>/tech-spec/definition-of-ready.md
   git commit -m "docs: add DoR for <TASK_ID> (<entity>)"
   ```

4. Tell the user: "DoR written. Status: READY / NOT READY. If NOT READY, update
   the task brief to address blocked items, then re-run `/arch-quality` (DoR)."

### Constitutional self-check (run before section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```text
Plugin Law A (common-stack first): complied | violated | N/A — <reason>
Plugin Law B (testable): complied | violated | N/A — <reason>
Plugin Law C (council quality): complied | violated | N/A — <reason>
Plugin Law D (stacked PRs): complied | violated | N/A — <reason>
Plugin Law E (complexity budget): complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests): complied | violated | N/A — <reason>
DoR Law 1 (mechanical only — no creative inference): complied | violated | N/A — <reason>
DoR Law 2 (single HITL — full checklist at once): complied | violated | N/A — <reason>
DoR Law 3 (FAIL = NOT READY, no threshold adjustment): complied | violated | N/A — <reason>
DoR Law 4 (progress.sh phase-check after approval): complied | violated | N/A — <reason>
DoR Law 5 (Playwright mandatory for browser tests): complied | violated | N/A — <reason>
```

If ANY line says "violated": STOP, revise the checklist, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

**Skill-specific Laws:**

- **DoR Law 1** — Evaluate mechanically against the task brief. Do not infer intent or
  fill gaps. If a field is absent, it is FAIL — do not assume the Engineer will figure it out.
- **DoR Law 2** — Single HITL only: present the full checklist in one pass. Do not ask the
  user section-by-section (this skill is a gate, not a collaboration session).
- **DoR Law 3** — Any FAIL renders the task NOT READY. No partial-ready status. No
  "close enough." A task must be fully ready or it goes back for rework.
- **DoR Law 4** — Always call `.claude/scripts/progress.sh phase-check` after writing the
  file. The implement skill depends on this state to determine whether to proceed.
- **DoR Law 5** — If any test scenario involves browser interaction, Playwright must be
  explicitly named in the test requirements (Law B enforcement at the DoR layer).

### Confidence block (emit before every HITL question)

Output this block immediately after presenting the checklist, before the AskUserQuestion call:

```text
<section-confidence>
Confidence: high | medium | low
Weakest part: <section name + specific item>
Why: <1 sentence — what input was missing or what you assumed>
</section-confidence>
```

Rules:
- Always name the weakest part, even on high-confidence checklists.
- "Why" must reference a specific input gap in the task brief.
- "The task is not fully specified" is not acceptable — name the field.
- The block lives in chat only — do not embed it in the file.

### Output

File: `docs/specs/weave/engines/<entity>/tech-spec/definition-of-ready.md`

Template: `.claude/spec-templates/tech-spec/definition-of-ready.md`

Create the directory if it doesn't exist. Never leave `{{PLACEHOLDER}}` in the output.

Frontmatter:

```yaml
---
type: Definition of Ready
title: "Definition of Ready: <TASK_ID> - <task title>"
description: "<one-line summary of the readiness verdict for this task>"
tags: [<entity>, arch, task]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: READY | NOT READY
task_id: <TASK_ID>
entity: <entity>
created: <YYYY-MM-DD>
reviewed_by: arch-quality skill
---
```

The body of the file is the checklist produced in Steps 2-3, with all items marked PASS or
FAIL and the overall verdict at the bottom. Do not include the confidence block or the
constitutional self-check trace in the file — those are chat-only.

#### File structure

```markdown
---
<frontmatter>
---

# Definition of Ready: <TASK_ID> - <task title>

A task is ready for the Engineer when ALL items below are checked (PASS). Any FAIL
means the task brief must be updated before implementation begins.

## 1. Task Brief Completeness

- [x] PASS — User story present ("As a graph editor, I want ...")
- [ ] FAIL — Acceptance criteria: AC-2 missing test mapping column
- [x] PASS — Pseudocode provided
- [x] PASS — API contracts defined (POST /api/triples: request/response schemas present)
- [x] PASS — No placeholder text remaining

## 2. Dependencies Identified

- [x] PASS — blocked_by: [TASK-003, TASK-007]
- [x] PASS — unlocks: [TASK-012]
- [ ] FAIL — Dependency summary missing: .claude/state/summaries/TASK-003.md not found
- [x] PASS — No circular dependencies detected

## 3. Diagrams Referenced

- [x] PASS — Sequence diagram: tech-spec/business-process.md#triple-ingestion
- [x] PASS — Data model: tech-spec/data-model.md#triple-entity
- [x] N/A — State diagram: no state machine in scope (documented)

## 4. Design Decisions Noted

- [x] PASS — ADR-007 (Oxigraph as RDF store): file exists, impact stated
- [x] PASS — Stack reference: CLAUDE.md § RDF store

## 5. Test Scenarios Specified

- [x] PASS — Unit tests: minimum 4 listed
- [x] PASS — Integration tests: minimum 2 listed
- [x] PASS — E2E tests: minimum 1 listed (Playwright specified)
- [x] PASS — AC-to-test mapping: all 3 ACs mapped
- [x] PASS — Edge cases: 2 identified (empty body, malformed triple)

## 6. Cost Estimate Provided

- [x] PASS — Complexity: M
- [x] PASS — Estimated tokens: ~12K input, ~4K output
- [x] PASS — Estimated cost: ~$0.04
- [x] PASS — M rating consistent with 5 ACs + 3 functions + 1 persistence layer

---

## Overall Readiness

Status: NOT READY
Failed items: 2
Blocking items:
- Section 1: AC-2 missing test mapping
- Section 2: .claude/state/summaries/TASK-003.md not found
```

### Evaluation Criteria

A well-produced DoR:

- Evaluates every checklist item against the actual task brief — no inferred PASS ratings
- Marks status FAIL for any missing or incomplete field, with a specific reference to the
  field or row that is absent
- Produces the overall `READY` verdict only when zero items are FAIL
- Is presented as a single HITL block (not drip-fed section by section)
- Has frontmatter with `status: READY | NOT READY` matching the overall verdict
- Calls `.claude/scripts/progress.sh phase-check` after approval before committing
- Has no `{{PLACEHOLDER}}` text in the output file
- Constitutional self-check trace present in chat; not embedded in the file
- Playwright is explicitly required for any AC that touches browser behaviour
