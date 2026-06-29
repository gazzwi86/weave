---
name: arch-task-brief
description: Produce a single self-contained task brief (TASK-NNN.md) for a Weave entity, complete enough that the engineer needs no other spec file. Invoked by the architect agent once per task, section by section with HITL review.
---

# Arch Task Brief Skill

Produce a single self-contained task brief (`TASK-NNN.md`) for a Weave spec entity, one section
at a time with HITL review after each section. Invoked by the Architect agent — once per task —
until all tasks for an epic are complete. The engineer who receives this file must not need to
open any other spec file to implement the task.

## Model

- **Drafting phase:** claude-opus-4-8 (deep reasoning, adversarial critic pass, explicit
  pseudocode, precise contract derivation)

Opus is used throughout: task briefs are implementation contracts, not prose summaries. Every
ambiguity in a task brief costs the engineer time. Opus's wider reasoning surface is worth the
extra cost to eliminate that ambiguity.

## Input

Before doing anything else, read:

1. `CLAUDE.md` — Weave product context, confirmed stack, Plugin Laws A-F, EARS notation rules
2. `.claude/spec-templates/task.md` — section structure (scaffold only; never leave `{{}}` in output)
3. `docs/specs/<entity>/02-prd/prd.md` — parent PRD; locate FRs that relate to this task
4. `docs/specs/<entity>/02-prd/epics/EPIC-NNN.md` — parent epic; inherit priority, phase ref,
   and story list
5. `docs/specs/<entity>/04-arch/tech-spec/architecture.md` — architecture decisions, API surface, data model
6. `docs/specs/<entity>/04-arch/tasks/` — scan existing TASK-NNN.md files to determine the next
   sequence number (zero-pad to 3 digits: 001, 002, …) and to avoid `blocked_by` / `unlocks` gaps
7. Any existing ADRs in `docs/specs/<entity>/04-arch/decisions/` that affect this task

Ask the user which entity, which epic, and which task (title or PRD story heading) if not supplied
as arguments. Derive the output path as:

`docs/specs/<entity>/04-arch/tasks/TASK-NNN.md`

## Instructions

### Step 0 — State the governing principle (never skip)

Write 2-3 sentences naming the principle that governs a task brief before writing anything else.

Example: "A task brief's job is to be a complete implementation contract: the engineer should be
able to write the first failing test before opening any other file. If the brief leaves any
decision to the engineer's discretion — auth strategy, error shape, store interaction — it has
failed. Ambiguity in a brief is a defect, not a feature request."

Reference this principle when justifying precision decisions during the HITL loop.

### Step 1 — Context ingestion

1. Read all files listed in the Input section above.
2. Identify the target task in the parent epic's User Stories table.
3. Summarise what you know in 4 bullets before proceeding:
   - What the task delivers (from the epic or PRD)
   - What tech-spec decisions constrain implementation (API surface, data model, auth pattern)
   - What adjacent tasks this may depend on or unlock (from the epic task list)
   - What is NOT yet decided (anything you will need to ask about)

Ask via AskUserQuestion:

- "How much is already specified in the tech-spec for this task?"
  Options: Full API contract defined / Partial (some endpoints) / Minimal (just data model) /
  Not yet — I'll describe it now

### Step 2 — Confirm user story before writing

Before writing any section, surface the proposed user story and confirm it.

1. Draft the user story as plain text:
   ```
   As a <role>
   I want <capability>
   So that <measurable benefit>
   ```
2. Include a one-line rationale explaining how the story maps to the epic and PRD.
3. Ask via AskUserQuestion:
   - "Does this user story look right?"
     Options: Approved / Amend role / Amend capability / Amend benefit / Rewrite from scratch

Only proceed to section-by-section production once the story is approved. A bad story produces
bad ACs.

### Step 3 — Section-by-section production

Produce the task brief in this exact order. For each section:

1. **Write** the section to the file
2. **Run the constitutional self-check** (see below) — stop and revise if any Law violated
3. **Run the adversarial critic pass** (see below) — stop and revise if any gap found
4. **Present** the section to the user (display the written content in full)
5. **Emit a confidence block** (see below) immediately before the HITL question
6. **Ask** via AskUserQuestion: Approve / Amend / Reject
7. If Amend: apply changes, show diff, re-present with updated confidence block
8. If Reject: regenerate with a cleaner approach, show the new version

**HITL batching:** Sections are presented individually. Do not batch-write multiple sections
before presenting. Each section gets its own Approve / Amend / Reject gate.

**Sections in order:**

#### Story

Four fields:

- **Epic:** relative link to the parent epic file (e.g. `[EPIC-001](../epics/EPIC-001.md)`)
- **Status:** always `Backlog` for a new task
- **Priority:** inherit from the parent epic's user stories table (`Must Have` / `Should Have` /
  `Could Have`)
- **User story:** the approved story from Step 2, formatted as `As a … / I want … / So that …`

Do not invent phase names or priority levels. Copy exactly from the epic.

#### Acceptance Criteria

**EARS notation is MANDATORY for every AC. No exceptions.**
Format: `WHEN [event] THE SYSTEM SHALL [behaviour]`

Rules for each AC:

- The behaviour must be observable: HTTP status code, response body field, log event, DB row,
  UI element state — something a test can assert without human judgment.
- Name Weave-stack specifics where relevant: Oxigraph, SPARQL endpoint, Aurora, Cognito JWT,
  CloudWatch, Playwright, pytest.
- Error paths are first-class ACs. If the task has an API endpoint, write at least one AC for
  the unhappy path (invalid input, unauthenticated, not found).
- Performance ACs must include a threshold and a load profile: "within 500ms at p95 under 10
  concurrent users".

Format as a table:

| ID   | Criterion (EARS)                                                     | Test Mapping        |
|------|----------------------------------------------------------------------|---------------------|
| AC-1 | WHEN … THE SYSTEM SHALL …                                            | `test name or file` |
| AC-2 | WHEN … THE SYSTEM SHALL …                                            | `test name or file` |

Deliver in batches of 5 ACs; ask Approve / Add / Amend after each batch.

**Anti-patterns (never write these):**

- "The endpoint works correctly." — unmeasurable, no observable outcome
- "Errors are handled." — which errors? what response?
- "Performance is acceptable." — no threshold, no load profile
- "All unit tests pass." — tautological, adds no constraint

#### Implementation: Pseudocode

The pseudocode is the most important section. A sceptical engineer should be able to write the
first failing test directly from the pseudocode, without opening the tech-spec, ADRs, or any
other file.

**Mandatory content:**

1. **Input gates first** — validate every input before any side-effect. Show the validation
   logic and the exact error shape returned.
2. **Error shapes spelled out** — every error path returns a named shape. Do not write
   `return error`. Write `return 422 with {"error": "invalid_url", "field": "url"}`.
3. **Store interactions named** — name the store (Oxigraph SPARQL Update, Aurora via
   SQLAlchemy, ElastiCache via Redis client) and the operation type (INSERT DATA, session.add,
   cache.set). Do not write `save to DB`.
4. **Decision branches explicit** — if the logic branches, show both branches and their
   postconditions.
5. **Happy path last** — write error paths before the success path so the engineer sees the
   full constraint surface.

**Format:**

```
function <functionName>(<params>):
  # Input gates
  if not <gate>: return <status> with {"error": "<code>", ...}
  if not <gate>: return <status> with {"error": "<code>", ...}

  # Core logic
  <named store operation>(<args>)  # e.g. sparql_client.update(INSERT DATA { ... })

  # Branch
  if <condition>:
    <branch A>
    return <status> with <shape A>
  else:
    <branch B>
    return <status> with <shape B>

  # Happy path
  return <status> with <shape>
```

**Bad pseudocode (never write this):**

```
function createTriple(data):
  // validate and save
  return success
```

**Good pseudocode (write this):**

```
function createTriple(jwt, subject, predicate, object_):
  if not jwt: return 401 with {"error": "unauthorised"}
  claims = cognito.verify(jwt)       # raises 401 if expired/invalid
  if not isIRI(subject):   return 422 with {"error": "invalid_iri", "field": "subject"}
  if not isIRI(predicate): return 422 with {"error": "invalid_iri", "field": "predicate"}

  graph = namedGraphFor(claims.tenant_id)
  sparql_client.update(
    "INSERT DATA { GRAPH <{graph}> { <{subject}> <{predicate}> <{object_}> } }"
  )  # raises SparqlUpdateError on store failure → 503

  return 201 with {"subject": subject, "predicate": predicate, "object": object_}
```

#### Implementation: API Contracts

Required for every task that creates, modifies, or deletes a resource. For read-only tasks,
write the query shape. If there is no API surface, write "N/A — internal service / CLI / agent
action" and explain the internal interface instead.

For each endpoint:

**`<METHOD> <path>`**

Request body (JSON schema, not TypeScript):

```json
{
  "field": "string — description (required)",
  "field2": "string | null — description (optional)"
}
```

Response `200` / `201` / `204`:

```json
{
  "field": "string — description"
}
```

Error responses:

| Status | Condition              | Body                                      |
|--------|------------------------|-------------------------------------------|
| 400    | Malformed JSON         | `{"error": "bad_request"}`                |
| 401    | Missing/invalid JWT    | `{"error": "unauthorised"}`               |
| 422    | Failed field validation | `{"error": "<code>", "field": "<name>"}` |
| 503    | Store unavailable      | `{"error": "store_unavailable"}`          |

Rules:

- Every field must have a type and a description. Never write `"field": "value"`.
- Error codes must be snake_case string literals (greppable in tests).
- Include the `Www-Authenticate` header specification for 401 responses.
- Include rate-limit headers if the endpoint is user-facing (`X-RateLimit-Limit`,
  `X-RateLimit-Remaining`, `Retry-After`).
- OpenAPI path parameters are `{param}` (curly braces), not `:param`.

#### Implementation: Diagram References

Link the engineer to exactly the diagrams they need — no more, no fewer.

| Diagram    | File                                   | Relevant Section        | Summary                                                   |
|------------|----------------------------------------|-------------------------|-----------------------------------------------------------|
| Sequence   | `../tech-spec/business-process.md`     | `#<anchor>`             | 1-line description of the interaction this task implements |
| State      | `../tech-spec/business-process.md`     | `#<anchor>`             | 1-line description of the state transition this task touches |
| Data Model | `../tech-spec/data-model.md`           | `#<anchor>`             | 1-line description of the entities this task reads/writes  |

Rules:

- All paths are relative to the task file's location.
- If a diagram type does not apply to this task, write "N/A" in the Summary column — never
  omit the row entirely.
- If the tech-spec diagram does not yet exist, write "Pending — to be added to tech-spec before
  implementation starts" and flag this as a DoR blocker.

#### Implementation: Design Decisions

| Decision                                        | Reference                              | Impact on This Task                                     |
|-------------------------------------------------|----------------------------------------|---------------------------------------------------------|
| <Decision title — name the actual choice made>  | [ADR-NNN](../decisions/ADR-NNN.md)     | How this constrains or guides the implementation        |

Rules:

- Every row must name the actual decision, not just the topic.
  Bad: "Authentication approach". Good: "AWS Cognito JWT validation via `python-jose`".
- Link to the ADR file if one exists. If the decision is in `CLAUDE.md`, write
  `[CLAUDE.md](../../../../../CLAUDE.md#architecture-decisions-confirmed)`.
- If no ADRs are relevant, write one row: "No task-specific ADRs — all decisions inherited
  from CLAUDE.md confirmed stack."
- After drafting this section, run the adversarial critic pass: "What design choices does the
  pseudocode or API contract make that are NOT covered by an ADR row?" Add them.

#### Test Requirements

Write concrete test stubs — enough for the engineer to start TDD without guessing test names or
file locations.

**Unit Tests (minimum N)**

State the minimum count. For backend tasks: minimum 3. For frontend tasks: minimum 3.
For tasks touching auth or data validation: minimum 5.

```
- should return 401 when JWT is absent
- should return 422 when <field> is not a valid IRI
- should call sparql_client.update with correct INSERT DATA graph string
- should return 201 with the persisted triple on success
- should return 503 when Oxigraph raises SparqlUpdateError
```

Each stub: `should <expected behaviour> when <condition>`. Concrete enough to write from. Not
`should work correctly`.

**Integration Tests (minimum N)**

State the minimum count. For tasks with API endpoints: minimum 2. For tasks with store
interactions: minimum 2.

```
- should persist a triple to Oxigraph and return it via GET /triples/{id}
- should reject an unauthenticated POST /triples with 401
```

Integration tests use LocalStack for AWS services (Plugin Law F). Name the service being
stubbed (e.g. "Cognito via LocalStack", "Aurora via test database fixture").

**E2E Tests (minimum N)**

State the minimum count. For tasks with UI: minimum 1 Playwright test. For pure API tasks with
no UI surface: write "N/A — no UI surface; covered by integration tests."

```
- should allow an authenticated user to add a triple via the ontology editor form
```

E2E tests use Playwright and run against a LocalStack-backed test environment.

#### AC-to-Test Mapping

Every AC must map to at least one named test. If an AC has no test, it is a DoR blocker.

| AC   | Test Type   | Test Name                                           |
|------|-------------|-----------------------------------------------------|
| AC-1 | Unit        | `should return 401 when JWT is absent`              |
| AC-2 | Integration | `should persist a triple to Oxigraph and retrieve`  |
| AC-3 | E2E         | `should allow authenticated user to add a triple`   |

Rules:

- Test Type must be one of: Unit / Integration / E2E.
- Test Name must exactly match a stub written in the Test Requirements section above.
- Every AC must appear in this table. If it doesn't, add it and add the corresponding test stub.

#### Dependencies

```
blocked_by: [TASK-NNN, TASK-NNN]   # or [] if none
unlocks:    [TASK-NNN, TASK-NNN]   # or [] if none
```

Rules:

- Cross-reference the parent epic's task list to find dependency candidates.
- A task is `blocked_by` another if it cannot be started without that task's output (schema,
  API, auth layer).
- A task `unlocks` another if the other task depends on this task's output.
- Never leave blank. Write `[]` if there are no dependencies.
- If a dependency is on an external system (Cognito pool provisioned, Oxigraph deployed), write
  it as a string: `"AWS Cognito user pool provisioned in staging"`.

#### Cost Estimate

```
Complexity:        S | M | L | XL
Estimated tokens:  ~NNNk input, ~NNk output
Estimated cost:    ~$N.NN
```

Size guide:

| Size | Scope                                                               |
|------|---------------------------------------------------------------------|
| S    | Single function, ≤ 3 ACs, no new data model, 1 endpoint or none     |
| M    | 2-4 functions, 4-6 ACs, minor data model addition, 1-2 endpoints    |
| L    | New module, 7-10 ACs, new data model entity, 3+ endpoints           |
| XL   | New sub-system boundary, 10+ ACs, multiple data models, 5+ endpoints |

Estimate tokens by: 2k base + 500 per AC + 1k per endpoint + 1k per diagram reference.
Estimate cost using claude-opus-4-8 input/output pricing (never use stale pricing — check
`.claude/memory/MEMORY.md` for any recorded pricing updates, otherwise note "pricing from
CLAUDE.md at time of writing").

#### DoR Checklist

Copy from template and resolve each item to checked or unchecked with a one-word reason for
any unchecked item. Never leave an item blank.

```
- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided
- [x] API contracts defined (if applicable)
- [x] Diagram references included
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided
```

If any item is unchecked, the task brief is NOT ready for handoff. Resolve the gap or explicitly
mark it as a known blocker with an owner.

#### DoD Checklist

Copy from template unchanged. The engineer owns this checklist during implementation.

```
- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic ≤ 10, cognitive ≤ 15, fn ≤ 50 lines)
- [ ] JSDoc / docstrings on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and parent epic
```

#### Implementation Hints

3-5 bullets. Each bullet must be specific to this task — not generic advice.

Good hints:

- "Use `rdflib.Graph.parse(format='turtle')` to validate incoming Turtle before inserting;
  it raises `rdflib.exceptions.Error` on malformed input."
- "The `sparql_client` fixture in `tests/conftest.py` already bootstraps an Oxigraph in-memory
  store — reuse it rather than mocking."
- "Cognito JWT verification is centralised in `app/auth/cognito.py::verify_token`; import that,
  do not reimplement."

Bad hints:

- "Follow best practices." — not actionable
- "Don't forget to test error cases." — already covered by ACs
- "Use the existing pattern." — which pattern, in which file?

### After all sections approved

1. Update the task file footer from the template default to:
   `*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*`

2. Run the final DoR check: verify every checklist item is `[x]` before committing. If any
   item remains `[ ]`, surface it to the user and resolve it first.

3. Commit the task file:

```bash
git add docs/specs/<entity>/04-arch/tasks/TASK-NNN.md
git commit -m "docs(<entity>): add TASK-NNN <task-title-slug>"
```

4. Update the parent epic's User Stories table: change the task row's Status from `Backlog` to
   `Ready` (DoR satisfied). Commit:

```bash
git add docs/specs/<entity>/02-prd/epics/EPIC-NNN.md
git commit -m "docs(<entity>): mark TASK-NNN ready in EPIC-NNN"
```

5. Tell the user:
   "TASK-NNN complete and marked Ready in EPIC-NNN. Run `/arch-task-brief` again to write the
   next task, or run `/implement` to begin coding TASK-NNN."

## Constitutional self-check (run before every section delivery)

Walk both Law layers. Write one line per Law, format exactly:

```
Plugin Law A (common-stack first):      complied | violated | N/A — <reason>
Plugin Law B (testable):                complied | violated | N/A — <reason>
Plugin Law C (council quality):         complied | violated | N/A — <reason>
Plugin Law D (stacked PRs):             complied | violated | N/A — <reason>
Plugin Law E (complexity budget):       complied | violated | N/A — <reason>
Plugin Law F (no real cloud in tests):  complied | violated | N/A — <reason>
Task Law 1 (EARS ACs):                  complied | violated | N/A — <reason>
Task Law 2 (self-contained brief):      complied | violated | N/A — <reason>
Task Law 3 (input gates first):         complied | violated | N/A — <reason>
Task Law 4 (error shapes spelled out):  complied | violated | N/A — <reason>
Task Law 5 (store interactions named):  complied | violated | N/A — <reason>
Task Law 6 (AC-to-test coverage):       complied | violated | N/A — <reason>
Task Law 7 (adversarial critic pass):   complied | violated | N/A — <reason>
```

**Task-specific laws:**

- **Task Law 1** — Every AC uses EARS notation (`WHEN … THE SYSTEM SHALL …`). No exceptions.
- **Task Law 2** — The brief is self-contained. The engineer must not need to open any other
  file to start coding. Any reference to another spec must be a direct quote or an inline
  summary, not just a link.
- **Task Law 3** — Pseudocode shows input gates first, before any store interaction or business
  logic. No side-effects before validation.
- **Task Law 4** — Every error path in the pseudocode has a named error shape (HTTP status +
  JSON body with `"error"` field). `return error` is not acceptable.
- **Task Law 5** — Every store interaction in the pseudocode names the store, the client, and
  the operation type. `save to DB` is not acceptable.
- **Task Law 6** — Every AC appears in the AC-to-Test Mapping table with at least one named
  test stub. If an AC has no test, the task is not ready.
- **Task Law 7** — Adversarial critic pass completed on Pseudocode and Design Decisions
  sections. Any gap found must be resolved before presenting.

If ANY line says "violated": STOP, revise the section, re-run the check.
Output the trace in chat (user sees it). Keeps Laws active across long sessions.

## Adversarial critic pass (run after drafting Pseudocode and Design Decisions)

After drafting each of these two sections, ask: "What would a sceptical engineer find
underspecified here?"

Checklist — answer each question. If the answer is "unclear" or "not addressed", revise before
presenting:

1. **Auth:** Is the authentication check explicit in the pseudocode, or assumed?
2. **Validation order:** Does validation happen before every store write? Any reachable path
   that skips it?
3. **Error shapes:** Can every `return <error>` be mapped to a concrete HTTP status + JSON body?
4. **Idempotency:** If the operation is called twice with the same inputs, is the behaviour
   defined (idempotent / last-write-wins / error)?
5. **Concurrency:** Is there a race condition between the check and the write? If yes, is it
   addressed (optimistic lock, SPARQL SILENT, upsert)?
6. **Missing ADR rows:** Does the pseudocode make any implicit choice (e.g. error code strings,
   graph naming, cache TTL) that is not covered by an ADR or CLAUDE.md decision?
7. **Test gap:** Is there an AC that cannot be verified by the test stubs listed?

Record findings as a bulleted list in chat. Add any identified gap to the Design Decisions
section before presenting it.

## Confidence block (emit before every HITL question)

Output this block immediately after presenting the section, before the AskUserQuestion call:

```
<section-confidence>
Confidence: high | medium | low
Weakest part: <name the specific AC, pseudocode branch, contract field, or table row>
Why: <1 sentence — what input was missing or what was assumed>
</section-confidence>
```

Rules:

- Always name the weakest part, even on high-confidence sections.
- "Why" must reference a specific input gap: missing tech-spec section, no ADR for this
  decision, performance threshold not stated in PRD. "The future is uncertain" is not
  acceptable.
- The block lives in chat only — do not embed it in the file.

Low-confidence triggers: tech-spec does not define the endpoint; data model entity not yet
confirmed; performance thresholds absent from PRD; no existing ADR for a decision the
pseudocode makes.

## Output

**File:** `docs/specs/<entity>/04-arch/tasks/TASK-NNN.md`

Where NNN is zero-padded to 3 digits (001, 002, …). Scan existing files in the directory to
determine the next number before writing.

**Template:** `.claude/spec-templates/task.md`

Create the directory if it doesn't exist:

```bash
mkdir -p docs/specs/<entity>/04-arch/tasks/
```

Never leave `{{PLACEHOLDER}}` in the output. All template variables must be resolved.

**Frontmatter:**

```yaml
---
type: Task Brief
title: "Task: TASK-NNN — <Task Title>"
description: "<one-line summary of what this task delivers>"
tags: [<entity>, 04-arch, task]
timestamp: <YYYY-MM-DDThh:mm:ssZ>
status: Backlog
priority: Must Have | Should Have | Could Have
entity: <entity>
epic: EPIC-NNN
created: <YYYY-MM-DD>
blocked_by: []
unlocks: []
adr_refs: []
---
```

**Footer line** (replace template default):

```
*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
```

## Evaluation Criteria

A well-produced task brief:

- Has a user story with a concrete role (not "user"), a specific capability, and a measurable
  benefit — derivable from the parent epic without guessing
- Has ≥ 3 ACs, all in EARS notation (`WHEN … THE SYSTEM SHALL …`), with at least one error-path
  AC and (for API tasks) at least one performance AC with a threshold
- Has pseudocode that shows input gates first, names all store interactions explicitly, and
  spells out every error shape — an engineer can write the first failing test from it alone
- Has API contracts with typed fields, error response table, and auth header specification
- Has an AC-to-Test Mapping where every AC maps to at least one named test stub
- Has a DoR Checklist where every item is checked and the task is genuinely ready to start
- Has no `{{PLACEHOLDER}}` text in the output file
- Was delivered section-by-section with HITL at every section
- Adversarial critic pass completed on Pseudocode and Design Decisions, with findings resolved
- Constitutional self-check trace present in chat for every section
- Committed with a conventional commit message (`docs(<entity>): add TASK-NNN <slug>`) and
  parent epic updated to mark the task `Ready`
