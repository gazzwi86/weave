---
type: Harness Improvement Backlog
title: Weave Harness Improvement Backlog
description: "Research-driven backlog of harness improvements for the Weave dark-factory SDLC, with analysis, impact hypothesis, mitigations, and priority ranking."
tags: [harness, improvements, backlog, dark-factory]
timestamp: 2026-06-29T00:00:00Z
resource: harness-improvements.md
---

# Weave Harness Improvement Backlog

## Executive summary

The Weave harness is a mature, spec-driven dark-factory: a Brief → PRD → Roadmap → Tech Spec →
Tasks cascade with per-artifact skills, PDAC implementation loops, phase-gated HITL, and a
`docs/` OKF knowledge bundle. Its biggest current leverage is not new machinery but closing
the gap between *human-readable* and *machine-executable* specs — every skill that an agent
consumes downstream must emit unambiguous, validatable contracts, and every generated file
must stay OKF-conformant so the knowledge graph never silently breaks.

See also: [claude-harness-overview.md](docs/claude-harness-overview.md).

---

## Implemented (pass 3)

Items 1–8 were implemented in the initial 3-pass overhaul:

1. **OKF `type` frontmatter on PO generators** — load-bearing fix; first /po run was non-conformant without it.
2. **Machine-readability checklist on `po-brief`** — AERO completeness test; brief must have falsifiable metrics, entity boundaries, non-goals.
3. **Cascade gate checks in `spec-review`** — per-transition blocker table (Brief→PRD→Roadmap→Arch→Impl).
4. **EARS-not-Gherkin fix in `spec-review`** — latent false-negative: was checking Given/When/Then against specs mandating `WHEN ... THE SYSTEM SHALL`.
5. **Auto-generated `# Related` cross-links** — OKF graph edges built as specs are written.
6. **State-aware elicitation pre-check** — `/elicit` Step 0 classifies Fresh / Refine / Gap-fill before running.
7. **Spec-health view in `status`** — maps phases per entity + OKF conformance check.
8. **OKF `type` frontmatter on arch generators** — same fix as item 1 for all arch skills.

---

## Priority ranking — outstanding items

Re-ranked after analysis pass. Top 10 are implemented below.

| Rank | Item | Category | Impact | Effort | Status |
|------|------|----------|--------|--------|--------|
| 1 | #10 Error classification | Autonomous Loop | Very High | M | **Implemented** |
| 2 | #9 Structured result blocks | Autonomous Loop | High | M | **Implemented** |
| 3 | #12 Slopsquatting gate | Quality Gates | Critical/Security | M | **Implemented** |
| 4 | #16 Phase summaries | Context Management | High | S | **Implemented** |
| 5 | #11 Executable ACs | Spec Quality | High | M | **Implemented** |
| 6 | #17 PreCompact state capture | Context Management | Medium | S | **Implemented** |
| 7 | #13 Semgrep / Bandit inner loop | Quality Gates | High (when code exists) | M | **Implemented** |
| 8 | #14 Mutation testing delta | Quality Gates | Medium | M | **Implemented** |
| 9 | #15 AST hallucination check | Quality Gates | Medium | S | **Implemented** |
| 10 | #19 ADR↔task linkage | OKF/Knowledge | Medium-High | S | **Implemented** |
| 11 | #20 SHACL-as-spec CI | Quality Gates | High (Constitution Engine) | L | Defer — needs source |
| 12 | #18 DOER/CHECKER model split | Autonomous Loop | Low marginal | S | Skip — /goal already uses Haiku |

---

## Outstanding items — analysis

### 9. Structured pass/fail result blocks from every skill

**Reflection.** Skills currently emit prose. The /goal loop and any orchestrating agent
must parse English to determine success/failure and branch accordingly. This is the deepest
architectural fragility in the dark factory — it works when prose is predictable but fails
silently on edge cases, partial completions, or unexpected error states.

**Impact hypothesis.** High. Every autonomous-loop improvement (error classification,
retry routing, phase-gate signalling) depends on the orchestrator reading a typed signal.
Without this, items 10 and the phase-gate reliability are best-effort. A single
YAML result block at the end of `implement`, `qa`, and `phase-gate` outputs makes all
downstream branching deterministic.

**Mitigations / alternatives.** Full JSON schema is overkill — a fenced ` ```result ` block
in YAML is parseable by regex and still human-readable. Minimal schema: `status` (ok/fail/blocked),
`artifact_path` (what was produced), `failure_class` (for fail only). An alternative is exit
codes via bash wrappers, but skills are LLM prompts not executables — this doesn't apply. The
YAML block is the right choice. The orchestrator reads the last ` ```result ` block in the
skill's output text.

---

### 10. Error classification before retry in the PDAC loop

**Reflection.** The most expensive failure mode in any autonomous coding loop is
*spec-ambiguity misclassified as a logic bug*. The agent retries 3× with the same wrong
interpretation, burning 10–20k tokens per attempt and producing the same incorrect output.
Classifying the failure first and routing spec-ambiguity back to `/architect` cuts this
waste entirely.

**Impact hypothesis.** Very high — this is the primary reason autonomous loops stall. Four
failure classes are sufficient and mutually exclusive: `logic` (fix in impl — most common),
`dependency` (missing package/config), `interface` (wrong API usage — hallucinated method),
`spec-ambiguity` (the task brief is underspecified — only fix is to improve the spec). Each
class gets a different resolution strategy; only `logic` should retry in place.

**Mitigations / alternatives.** Self-classification by the engineer agent may be biased toward
`logic` (it wants to retry its own code). Better: a short classification prompt (could be Haiku)
that reads the QA failure report and tags the failure class before routing. This also respects
the item 9 result block — the class appears in the `failure_class` field. The retry ceiling
(3 for `logic`, 1 for `dependency`/`interface`, 0 for `spec-ambiguity`) is in `implement`'s
ASSESS step and persisted to `progress.json` as a `retry_count` field.

---

### 11. Executable acceptance criteria audit

**Reflection.** Task ACs currently read like "user can create an entity". For TDD-first
development, the test must exist *before* the code and the AC must be specific enough to
name — or at least describe — the test. Without this, TDD is nominal: the engineer writes
whatever tests seem reasonable rather than tests that contractually verify the AC.

**Impact hypothesis.** High for spec-to-implementation fidelity. The gap between "passing
tests" and "correct behaviour" is almost always an AC that was too vague to drive the test
design. Making every AC contain a measurable outcome and a named test description closes
this gap at the spec phase, before a single line of code is written.

**Mitigations / alternatives.** Don't require exact function names upfront — they're too
brittle (refactoring breaks them). Require an EARS-formatted AC paired with a *test
description*: what the test exercises, what it asserts, and which acceptance condition it
verifies. The engineer writes the test to match the description, not the other way around.
Alternative: BDD scenario format (not Gherkin syntax) that specifies inputs and expected
outputs — more concrete than prose ACs, less brittle than function names.

---

### 12. Slopsquatting / dependency pre-install gate

**Reflection.** A critically underappreciated risk. LLMs confidently emit package names
that don't exist on PyPI/npm. Roughly 20% of LLM-recommended packages are fictitious;
some non-existent names are registered by attackers specifically to intercept LLM-generated
install commands. A generated `requirements.txt` with one hallucinated package is a direct
supply-chain attack vector that bypasses every other security gate.

**Impact hypothesis.** Critical. This gate should exist before any package installation runs
— a PreToolUse hook on Bash that intercepts bare package manager invocations before they
execute. Verifying package existence on PyPI (`pip index versions <pkg>`) takes ~500ms per
package and blocks the install if any package is unresolvable. Unlike `pip-audit` (which
scans after installation), this prevents the installation entirely.

**Mitigations / alternatives.** Primary check: `pip index versions <pkg>` (PyPI) /
`npm view <pkg>` (npm registry) — simple HTTP lookups, no installation required. Secondary:
`pip-audit` / `npm audit` scanning post-install for CVEs. Allowlist alternative: maintain
an approved-packages manifest and reject anything not on it — stricter but eliminates
the class of risk entirely. The hook should be a hard block (exit 2, blocked message)
not a warning. Register in `settings.json` as a PreToolUse Bash matcher.

---

### 13. Semgrep / Bandit in the inner loop

**Reflection.** Static analysis run only at the end of implementation is too late — you've
built additional code on top of vulnerable patterns by then. LLM-generated code carries
approximately 2.7× more security vulnerabilities than human-written code in controlled
studies. SAST at the per-task granularity catches injection, path traversal, hardcoded
secrets, and SQL patterns while the context is still hot.

**Impact hypothesis.** High for security correctness once source code exists. Semgrep
(`p/python`, `p/security-audit`, `p/secrets`) on git-changed files only takes ~5 seconds.
The 2.7× vulnerability rate is the most compelling reason to run this per-task rather than
as a final scan. For Python specifically, Bandit is faster and purpose-built; for TS,
adding the `eslint-plugin-security` rules to the existing ESLint config is zero-overhead.

**Mitigations / alternatives.** Speed: run `semgrep --include $(git diff --name-only HEAD)`
or `bandit -r $(git diff --name-only HEAD | grep .py)` — changed files only. Cost: use
open-source rules only (no Semgrep Pro required). Fallback: if Semgrep is not available,
Bandit (Python) + ESLint security plugin (TS) cover ~80% of the same findings and are
already in the stack. Add these as the primary recommendation; Semgrep as optional enhancement.

---

### 14. Mutation testing on the changed delta

**Reflection.** A 70% mutation score at module level is too slow for a per-task loop and
would block forward progress. Delta-scoped mutation — mutating only the files changed in
the current task — is ~10× faster and catches the specific gap: tests that cover the new
code but don't actually kill mutations (i.e., tests that pass whether or not the logic is
correct).

**Impact hypothesis.** Medium. The primary value is catching *low-quality tests* — tests
that don't kill any mutants are assertion-free or always-passing, and they give false
confidence. Delta mutation is the cheapest way to enforce test quality without a full-suite
mutation run. `mutmut run --paths-to-mutate=$(git diff --name-only HEAD | grep .py)` is
the right command; `stryker run --incremental` for TS.

**Mitigations / alternatives.** Mutation testing can still be slow on delta if the changed
files have complex logic. Run async with a 90-second timeout: if it finishes under 70%,
block; if it times out, warn and continue (timeout failures should not block the loop).
Property-based testing (Hypothesis for Python, fast-check for TS) is a complement, not a
substitute — it generates adversarial inputs rather than mutating code, catching different
failure modes. Both together is the strongest combination.

---

### 15. AST-based import/API hallucination check

**Reflection.** `mypy --check-untyped-defs` (Python) and `tsc --noEmit` (TypeScript) are
already in the project's toolchain standards. Running them as a *pre-test* step — before
the full test suite — catches hallucinated method calls (`obj.nonexistent_method()`),
missing imports, and wrong argument counts in ~1 second, not after a 30-second test run
fails on `AttributeError`.

**Impact hypothesis.** Medium. This is already partially caught by linting (`ruff check`
with F821/F401 rules is already mandated in `docs/standards/`). The incremental value is
catching *type-level* hallucinations that ruff misses: calling a real method with the wrong
signature, accessing a non-existent attribute on a typed class. For TypeScript, `tsc --noEmit`
is already the strictest available check and should already be running — this is a reminder
to add it explicitly to the inner loop.

**Mitigations / alternatives.** `pylint -E` is the lighter alternative to mypy for Python
(only error-level checks, no type inference). For TypeScript, `tsc --noEmit` is the
definitive check. The key is running this *before* tests, not instead of tests. If mypy is
too slow (unlikely for changed-files-only), `ruff check --select F` covers the core
undefined-name cases already. Add the step to `implement`'s VERIFY phase.

---

### 16. Incremental, reasoning-preserving phase summaries

**Reflection.** The current state file (`progress.json`) tracks task *status* but not
*reasoning*. When a long `/implement` session compacts or resumes cold, the agent knows
which tasks are done but not *why* certain decisions were made — which library was chosen,
which ADR constraint was binding, which approach was rejected. This reasoning is exactly
what prevents contradictory decisions in later tasks or phases.

**Impact hypothesis.** High with S effort — the best return in the backlog. `stop.py`
already fires the phase gate. Adding a 200-word structured summary write (decisions, rationale,
constraints discovered) before the HITL gate costs one skill write. A cold-resume agent
reading `.claude/state/summaries/phase-N.md` recovers intent, not just state. The QA skill
already has a Step 0 preflight that reads task summaries — this extends the pattern to phases.

**Mitigations / alternatives.** Keep summaries short (≤300 words, structured YAML/markdown
template). Fields: `phase`, `entity`, `decisions[]` (choice + rationale each), `constraints_discovered[]`,
`approach_rejected[]`. Don't try to capture everything — capture only what would change
a future agent's approach. Alternative: append to CLAUDE.md at phase gates (always in
context, no injection needed), but CLAUDE.md grows unbounded and becomes noise. The separate
`.claude/state/summaries/` directory is the clean separation.

---

### 17. PreCompact state capture (PostCompact fallback)

**Reflection.** The original suggestion was a `PostCompact` hook to re-inject state after
compaction. `PostCompact` is not confirmed as a real hook event in the current Claude Code
version — `settings.json` shows `PreCompact` (confirmed real) but no `PostCompact`. The
pragmatic implementation: use `PreCompact` to *write* the current state to a summary file
*before* compaction, and use `SessionStart` (already firing) to *read* that file and inject
it into context on resume.

**Impact hypothesis.** Medium. `PreCompact` fires before the context is trimmed — the agent
still has full awareness of what it was doing. Writing the current entity/phase/open-task/
last-decision to `.claude/state/summaries/latest.md` at that moment is cheap and reliable.
`SessionStart` already calls `memory.inject_memory_index` — extending it to also read
`summaries/latest.md` achieves context continuity across compaction without a `PostCompact` event.

**Mitigations / alternatives.** If the session ends normally (not via compaction), the
`SessionEnd` hook (already in settings.json) can write the same summary. This gives
belt-and-suspenders: either `PreCompact` or `SessionEnd` writes `latest.md`, and
`SessionStart` reads it. The only edge case is a crash — which `progress.json` already
covers for task state.

---

### 18. DOER/CHECKER model split at the phase gate *(skipped)*

**Reflection.** The `/goal` Stop hook already uses Haiku for completion evaluation (per
project memory). The phase gate fires via the same Stop hook mechanism. The incremental
value of routing the *phase gate check specifically* to Haiku is low — the check is
infrequent (once per phase, not per task) and the main cost is the implementation session
(Sonnet), not the gate evaluation.

**Impact hypothesis.** Low marginal. Haiku for the completion check saves maybe 2–3k tokens
per phase gate. The structural benefit (tighter, less creative completion check) is real
but already mostly achieved by the `/goal` Haiku evaluation. This is worth revisiting
when costs become a constraint; skip for now.

**Alternative.** The item 9 result block (structured output from phase-gate) achieves the
same "precise branching" goal without model routing complexity.

---

### 19. ADR↔task linkage

**Reflection.** The Constitution Engine will generate ~10 ADRs (RDF store choice, auth
approach, OWL profile constraints, API design decisions). Every task that is *governed* by
an ADR should reference it. Without linkage, an engineer implementing task 7 might not know
that ADR-003 forbids a particular OWL 2 Full pattern — the task passes all tests but ships
an architecturally non-compliant ontology.

**Impact hypothesis.** Medium-high for architectural compliance, especially for the
Constitution Engine where OWL/SHACL constraints are subtle and binding. The fix is minimal:
an `adr_refs: [ADR-003]` field in the task frontmatter (emitted by `arch-task-brief`) and
a check in `spec-review` that flags tasks with no `adr_refs` when ADRs exist. The OKF
graph then surfaces the linkage visually (task node → ADR node edge).

**Mitigations / alternatives.** Don't require exhaustive coverage — just the *binding* ADRs
that constrain the implementation approach for that specific task. The OKF cross-link in the
`# Related` section of the task brief (already required by the pass 3 changes) is a lighter
alternative — it achieves the graph edge without requiring a structured field. Use both:
structured field for programmatic checks, markdown link for graph edges.

---

### 20. SHACL-as-spec CI validation for the Constitution Engine *(deferred — needs source)*

**Reflection.** This is the right long-term answer for the Constitution Engine's data tier
but requires committed `.ttl` files to validate against. The specification produces SHACL
shapes; those shapes *are* the executable spec for the ontology. A CI job that runs
`pyshacl --validate` on committed ontology changes makes the spec machine-enforced — the
same discipline that BDD brings to behaviour.

**Impact hypothesis.** High specifically for Constitution Engine correctness. An ontology
that violates its own SHACL shapes is like production code that fails its own contract
tests. Without this gate, ontology drift goes undetected until a downstream query returns
wrong results.

**Mitigations / alternatives.** OWL DL satisfiability check (via an OWL reasoner like
Owlready2 or Robot) should *precede* SHACL in CI — a non-satisfiable ontology makes SHACL
validation meaningless. Use `pyshacl` (Python, in-stack) rather than a Java-based processor.
Start with a pre-commit hook on `*.ttl` changes (pyshacl is fast), graduate to a CI job
once the ontology is established.

---

## Implementation record — top 10

| Item | What was changed |
|------|-----------------|
| #9 | `implement`, `qa`, `phase-gate` SKILL.md — structured `result` YAML blocks defined and required |
| #10 | `implement` SKILL.md — ASSESS step extended with 4-class failure taxonomy + routing + retry ceiling |
| #12 | `hooks.py` + `settings.json` — `check-install-safety` PreToolUse hook intercepting bare package manager calls |
| #16 | `phase-gate` SKILL.md — phase summary write step before HITL gate |
| #11 | `arch-task-brief` SKILL.md — AC must pair EARS requirement with test description; `spec-review` audits this |
| #17 | `hooks.py` — `pre-compact` handler writes `latest.md`; `session-start` reads and injects it |
| #13 | `implement` SKILL.md — VERIFY step adds Bandit (Python) / ESLint-security (TS) on changed files |
| #14 | `qa` SKILL.md — mutation delta step (mutmut / stryker incremental) with 90s timeout |
| #15 | `implement` SKILL.md — pre-test step: `mypy --check-untyped-defs` (Python) / `tsc --noEmit` (TS) |
| #19 | `arch-task-brief` SKILL.md — `adr_refs` field; `spec-review` flags tasks missing ADR linkage |
