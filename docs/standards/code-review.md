---
type: reference
---

# Code Review Standard

The single source of truth for how pull requests are reviewed in Weave — by humans and by
the CI review bot alike. The bot (`.github/workflows/claude-review.yml`) reads this file at
review time, so keep it current; when this document changes, review behaviour changes.

Synthesised from Google's Engineering Practices, Conventional Comments, the OWASP code-review
guidance, and Anthropic's Claude code-review tooling, then grounded in this repo's Definition
of Done (`.claude/skills/arch-quality`), the QA categories (`.claude/agents/quality-assurance.md`),
and the standards in this directory.

## The standard

Approve a change once it **definitely improves the overall code health of the system** — even
if it is not perfect. There is no perfect code, only better code. Do not block a net-positive
change while chasing polish; raise non-blocking suggestions and let the author decide, or file
a follow-up.

## What to look for, in priority order

Design and correctness first; style last. The linter and CI own style — reviewers own judgement.

1. **Design** — Does the change belong here and integrate cleanly with the surrounding system
   and the engine boundaries (Constitution / Build / Events / Explorer)? Does it respect the
   inter-engine contracts (`docs/specs/weave/contracts.md`) — citing contract IDs, never
   inventing endpoints?
2. **Correctness** — Logic errors, unhandled edge cases, off-by-one, null/None, race
   conditions, wrong error handling, and subtle regressions to existing behaviour.
3. **Security** — See the checklist below and `.claude/rules/security.md`.
4. **Spec & Definition of Done alignment** — Does the change satisfy its task brief's
   acceptance criteria (EARS) and the DoD (sections A–E in `.claude/skills/arch-quality`)? Flag
   any `Must` requirement that the diff claims to deliver but does not.
5. **API contracts & data model** — Do the API entities, endpoints, Pydantic v2 models, and
   SQLAlchemy/RDF shapes referenced by the change actually exist and match the OpenAPI spec and
   contracts? Flag breaking changes to signatures, schemas, or response shapes.
6. **Tests** — New logic has meaningful tests (not just coverage theatre); critical paths and
   edge cases are exercised; deterministic checks (build, typecheck, lint, unit/integration)
   are green. TDD-first, coverage ≥ 80% line, mutation ≥ 60% for changed modules.
7. **Complexity, naming, comments, docs** — Within the budgets in `complexity.md` (cyclomatic
   ≤ 10, cognitive ≤ 15, function ≤ 50 lines, file ≤ 300, params ≤ 5, nesting ≤ 4). Names
   convey intent; comments explain *why*, not *what*; public APIs documented.
8. **Style / consistency** — Only what the toolchain does not already enforce. Nit-level.

## Project-level judgement (the highest-value part)

Beyond line-by-line review, assess the change against the product goal:

- **MVP alignment.** Weave's MVP criterion: *one real client models their company → Weave
  auto-generates one working artefact*. Does this changeset move toward that, or add scope that
  doesn't yet need solving? Speculative generality is complexity — call it out.
- **New-user → feature flow.** For user-facing work, trace the path a **brand-new user** takes
  from first arrival to the feature(s) this PR delivers, and check the journey holds end to end:
  - the UI states exist and wire together (routing, empty/loading/error states, forms);
  - the API entities and endpoints those screens call actually exist and return the shapes the
    UI expects;
  - the data model (Pydantic / SQLAlchemy / RDF+SHACL) supports the flow.
  Call out any broken or missing link with `file:line` evidence. Ground this in the code, the
  deterministic results in `.ci-review/checks.md`, any E2E/Playwright specs, and explicit
  logical inference — and state plainly what you could and could not verify.

## Severity taxonomy

Tag every finding. Labels follow Conventional Comments; the tier drives the merge gate.

| Tier | Meaning | Conventional Comment form | Merge gate |
|---|---|---|---|
| **blocker** | Correctness / security / data-loss; makes code health worse | `issue (blocking):` | Must be resolved before merge |
| **major** | Real problem, not catastrophic; design or test gap | `suggestion (blocking):` / `issue (non-blocking):` | Should fix; author may justify |
| **minor** | Small improvement, author's discretion | `suggestion:` / `todo:` | Optional |
| **nit** | Pure preference / polish | `nitpick:` | Never blocks |

Non-gating labels are encouraged where they fit: `question:` (genuine uncertainty),
`thought:` (an idea, non-blocking), and `praise:` (reinforce genuinely good work).

On this repo, unresolved review threads block merge (branch protection requires conversation
resolution on `main`), so anchor real findings as inline review comments — not just prose.

## Comment discipline

- **Confidence gate.** Report only findings you are **> 80% confident** are real. When unsure,
  stay silent or ask a `question:`. A false blocker costs more trust than a missed nit.
- **Cite, don't infer.** Every behaviour claim needs a `file:line` citation in the source — not
  an inference from a name.
- **Don't duplicate the toolchain.** Never report what CI, the linter, the formatter, or the
  type-checker already catches (lint, formatting, type errors, import order, style).
- **One finding per comment**, anchored to the exact line, with a concrete suggested fix where
  it helps. Give guidance and the *why*; it is the author's job to fix, not the reviewer's.
- **Cap the noise.** At most **5 nits** per review; if there are more, say "plus N similar" in
  the summary rather than posting them inline. On re-review, suppress new nits and post
  blockers/majors only.
- **Comment on the code, not the person.** Describe the code's effect ("this adds concurrency
  without a measurable benefit"), never "why did you…". Balance criticism with praise.
- **Scope to the diff.** Review the diff and the code it directly touches. Do not review
  unchanged code; skip generated files, vendored deps, and `*.lock` files. A genuine
  pre-existing bug adjacent to the change may be noted as `thought:` / `question:`, not a blocker.

## Security checklist (diff-reviewable)

Trace user-controlled input through the diff — received → validated → transformed → passed on.
Grounded in `.claude/rules/security.md` and OWASP Top 10:

- **Injection (A03)** — no query/command built by string concatenation with input; parameterised
  queries only (SQLAlchemy params, never f-strings); no shell exec or unsafe file paths from
  input; context-aware output encoding against XSS.
- **Broken access control (A01)** — every new/changed endpoint enforces authz server-side,
  default-deny; object-level ownership checks (no IDOR); no client-trusted role/permission fields.
- **Secrets** — no hardcoded passwords, API keys, or tokens; secrets come from AWS Secrets
  Manager only; never committed in `.env`.
- **Input validation** — validated and sanitised at boundaries via Pydantic v2 (backend) / Zod
  (frontend); allowlist-based, length-bounded.
- **Crypto & auth (A02/A07)** — modern algorithms, CSPRNG for tokens/IVs, salted password
  hashing (argon2/bcrypt), TLS with hostname verification; `HttpOnly`/`Secure`/`SameSite` cookies.
- **Deserialization / SSRF (A08/A10)** — no unsafe deserialization of untrusted data; XML parsers
  hardened against XXE; server-side fetches to input-derived URLs require an allowlist and block
  internal ranges.
- **Logging (A09)** — security events logged; secrets and PII never logged.
- **No dynamic execution** — no `eval()` or `Function()` in frontend TypeScript.

## Output format (CI bot)

- Post **inline PR review comments** on the exact lines for specific findings (these become the
  resolvable threads the merge gate requires). Use a **top-level summary** for the project-level
  judgement and general notes.
- Lead the summary with a one-line tally — e.g. `2 blockers, 1 major, 4 nits` — or
  `No blocking issues.` — then the new-user-flow verdict (`yes` / `partial` / `no`, with what was
  verified).
- End with a machine-readable footer so CI can parse the verdict later:

```html
<!-- weave-review: {"blocker":N,"major":N,"minor":N,"nit":N,"mvp_aligned":true,"flow_verified":"yes"} -->
```

## Anti-patterns (do not)

- Do not hallucinate or infer findings without a source citation.
- Do not review unchanged code or restate linter/type-checker output.
- Do not flood with nits or re-litigate style the toolchain owns.
- Do not block a net-positive change on perfection — prefer follow-ups.
- Do not let a long rubric dilute the rules that matter: correctness, security, and whether the
  user's journey actually works.
