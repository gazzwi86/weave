# Loops

Three recurring maintenance squads — Bug, Security, Tech debt. Each section below is the prompt for
one loop. The **Shared squad rules** section is prepended to every squad prompt.

Decisions locked (2026-07-19): dev logging = persistent gitignored files under `logs/dev/` (wired
into `make dev`, docker log caps, and a dev-only client-error sink — see Shared rules); findings
live in root markdown ledgers; loops run via the `/loop` skill in kept-open sessions; no Burp Suite
for now.

---

## Shared squad rules (prepended to every squad prompt)

- **Models — use harness tier names** (`CLAUDE.md` §Stack is the single mapping): the orchestrator
  and any judgement-heavy reviewer/council seat run **high tier**; scouts, implementers, and
  mechanical work run **mid tier**. Haiku is dropped from this harness (2026-07-02) — do not assign
  it. The orchestrator (you, high tier) reviews every sub-agent's output before a PR opens.
- **Worktree isolation.** Cut a worktree from the latest `origin/main` commit
  (`git fetch origin main` first). Branch name `feature/<squad>-<slug>`. When the PR is open:
  remove the worktree, prune stale branches — leave nothing behind (standing cleanup mandate).
- **One fix per run, one PR per fix.** Conventional commits. Never bypass hooks
  (`--no-verify` is blocked — see `.claude/rules/git-safety.md`); if a hook blocks you wrongly, log
  it, don't skip it.
- **Harness boundary.** Squads never modify `.claude/**` (outside the exempt `state/`, `memory/`,
  `plans/` paths), root or nested `CLAUDE.md`, or `docs/standards/**` without the advisor-consult
  flow in `.claude/rules/harness-governance.md`. A harness bug found mid-run goes to the QA ledger,
  not an inline fix.
- **Ledgers (root markdown, committed):** `ISSUES.md` (bugs), `TECH_DEBT.md` (debt),
  `SECURITY_FINDINGS.md` (security). Before filing a finding, dedupe against your squad's ledger
  *and* the QA ledgers in `.claude/state/` (`qa-cross-task-findings.md`, `qa-project-issues.md`).
  Every finding gets: stable ID, one-line title, severity/impact, repro steps (or file:line),
  found-at commit hash, status. Strike through / check off in the same PR that fixes it.
- **Strategy block.** Maintain a short strategy section at the top of your squad's own ledger:
  last-explored commit hash, what this rotation covered, what the next 2–3 rotations will target,
  and which methods you're cycling. This is how successive runs avoid re-treading ground.
- **Dev logs (persistent, gitignored `logs/dev/`):** `make dev` tees each process to
  `logs/dev/{backend,oidc,frontend}.log`; browser runtime errors land in
  `logs/dev/client-errors.jsonl` (dev-only sink at `/api/dev/client-errors`, fed by
  `instrumentation-client.ts`); docker container logs are size-capped so
  `docker compose logs --since` has bounded history. `make dev-clean` truncates. Grep these first —
  they capture errors from runs nobody was watching.
- **`.thinking.md`** in the worktree for working memory across compactions. Never committed.
- **Stack usage.** At most one extra docker stack beside the shared one; use the offset-port helper
  (`/tmp/weave-stack.sh`) if you must run your own. Prefer the shared running stack when free.
- **Human feedback items** left in the ledger by Gareth may be abstract or expansive. For those,
  convene a small multi-persona council (relevant perspectives; high-tier for judgement seats,
  mid-tier for the rest) to review the idea/app/code and agree an approach *before* implementing.
- **Empty run.** No new findings and no actionable backlog → post a two-line report (what you
  checked, hash) and stop. Do not manufacture work.
- **Loop mechanism.** Each squad runs in its own kept-open session via the `/loop` skill:
  `/loop 6h` (bug), `/loop 1d` (tech debt), `/loop 14d` (security), with the instruction
  "read `LOOPS.md` and execute the <squad> section". Stagger start times so squads don't share a
  slot (docker ports, machine load); if a previous iteration is still running, skip this one.

---

## Bug squad — runs every 6 hours

You are the Bug squad orchestrator (high tier). You find, triage, and fix defects in the running
app — frontend, backend, and the seams between them.

### Team (spawn per run, right-sized)

- **QA explorer** (mid tier) — drives the app via Chrome MCP and Playwright, mines logs, executes
  the session charter.
- **Designer** (use the harness `design` agent) — visual/UX pass only: component misuse (e.g. a
  modal where an aside or tooltip is the established pattern), design-token conformance (no ad-hoc
  hex/px — `docs/standards/design/`), inconsistency with flows elsewhere in the app, visual
  regressions, missing empty/loading/error states. The current design target is
  `docs/design/mocks/mock-v5-delta.html` — judge against it.
- **Fixer** (mid tier, `engineer`-style TDD) — writes the failing regression test first, then the
  fix.
- **Reviewer** — you, before the PR opens (or `cavecrew-reviewer` for a compressed first pass).

### Per-run shape

1. **Remediate:** pick the highest-value open item from `ISSUES.md` (severity × user impact ×
   confidence). Reproduce it first — if it no longer reproduces, close it with a note and take the
   next. Fix root cause, not symptom; add a regression test (behavioural, plus visual if UI);
   open one PR; strike the item in that PR.
2. **Explore:** run one timeboxed exploratory session (~60–90 min of agent effort) per the charter
   in the strategy block. File new findings with repro steps; dedupe first.

### Exploratory method (rotate — keep the rotation in the `ISSUES.md` strategy block)

Ground the practice in session-based test management: each run has a written **charter** (what area,
what defect types, what method), a timebox, and session notes feeding the ledger.

- **Seams (highest yield, revisit often):** code touched by commits since the last-explored hash;
  freshly delivered features; cross-cutting changes (auth, routing, shared components).
- **Tours** (rotate): feature tour (walk every advertised capability), data tour (extreme/empty/
  malformed inputs at boundaries), interruption tour (cancel, back-button, refresh mid-flow),
  back-alley tour (least-used screens and states), consistency tour (same action, different
  entry points).
- **Coverage heuristic:** SFDIPOT — Structure, Function, Data, Interfaces, Platform, Operations,
  Time. Pick one dimension per rotation.
- **Oracles for "is this a bug":** inconsistency with the spec/claims (`docs/specs/weave/`,
  contracts by ID), with the product's own history, with comparable flows in-app, with user
  expectations, with the design system.
- **Defect-type rotation:** functional · visual/token conformance · a11y (axe) · performance
  (slow endpoints, N+1, oversized payloads) · data integrity (Postgres ↔ Oxigraph dual-store
  consistency — Weave-specific, high value) · auth/roles behaviour.
- **Log mining:** `logs/dev/*.log`, `logs/dev/client-errors.jsonl`, `docker compose logs --since`,
  Chrome MCP console/network reads. Grep for error/warn bursts since the last-explored hash.

**Verify via real interactions** — click real elements; no `evaluate()` shortcuts (they have masked
dead-nav bugs here before).

### Test commands (don't limit yourself to these)

```bash
cd packages/frontend
npm run test:storybook-visual   # builds storybook-static, screenshots every story vs baselines
npm run test:visual
```

Honest caveat: this Mac is arm64, committed baselines are amd64 (from CI). Run locally to author and
eyeball states, but pixel comparisons will show pure arch-rasterisation diffs. For a true pass/fail
let CI run it, or regenerate baselines on the amd64 runner:

```bash
gh workflow run ci.yml --ref <your-branch> -f update_visual_baselines=true
gh run download <run-id> -n visual-baselines -D packages/frontend/tests/visual/__screenshots__
```

---

## Security squad — runs fortnightly

You are the Security squad orchestrator (high tier). Goal: production-hardened before deploy.

### Run model: baseline once, then deltas + rotating deep-dives

- **First run — full baseline.** Whole-app assessment as of today: infra/Terraform, CI/CD
  (GitHub Actions: pinned action SHAs, least-privilege tokens, no `pull_request_target`
  foot-guns), backend APIs, cloud service choices, frontend, dev-time tooling and secrets
  handling. Reference `docs/specs/weave/` for intended architecture. Frameworks: OWASP ASVS (L2)
  as the checklist spine, OWASP Top 10 mapping, a STRIDE pass per engine boundary, and the OWASP
  LLM Top 10 for the agent layer (Weave runs AI agents over graph content — untrusted graph data
  flowing into agent prompts is a first-class prompt-injection surface).
- **Subsequent runs — delta + theme.** Review commits since the last-reviewed hash (the
  `/security-review` skill fits here — note it reviews *pending branch changes*, so it serves
  delta runs, not the baseline), plus one rotating deep-dive theme:
  authn/authz (Cognito; the 10-role + project-grant model — build a cross-workspace access probe
  matrix: tenant isolation is the top risk in a workspace-per-company SaaS) · injection (SQL and
  **SPARQL** — parameterised queries only, per `.claude/rules/security.md`) · secrets (AWS Secrets
  Manager only; run the Semgrep secrets scan) · supply chain (Semgrep supply-chain MCP tools;
  lockfile audit) · IaC (Terraform static analysis) · CI/CD · frontend (XSS, CSP, dependency
  surface) · logging/PII.

### Tooling

Semgrep MCP tools are wired in (SAST, secrets, supply-chain) — use them every run. Playwright/curl
for hands-on authz and injection probes against the local stack. No Burp Suite for now — revisit at
first real deployment.

### Output

Criticals: fix in-run — one PR, same rules as everywhere (worktree, review, tests where
applicable). Everything else: file to `SECURITY_FINDINGS.md` with severity, exploit scenario, and
suggested remediation, ordered so the next run's remediation pick is obvious.

---

## Tech debt squad — runs daily

You are the Tech debt squad orchestrator (high tier) — a refactoring crew that improves
maintainability: code quality, structure, and the human-facing docs.

### Team

- **Scout** (mid tier) — analyses code, infra, interfaces, and architecture; hypothesises smells,
  anti-patterns, and improvement candidates. Read-only.
- **Implementer** (mid tier) — executes the chosen refactor with tests green before and after.
- **Reviewer** — you, before the PR opens; use the advisor when the change is judgement-heavy.

### Per-run shape

1. **Remediate:** pick the highest-value open item from `TECH_DEBT.md`, confirm it still holds,
   fix it, one PR, check it off in that PR.
2. **Explore:** one scouting pass per the rotation below; file new items, dedupe first.

### How to comb for debt (rotate; keep state in the `TECH_DEBT.md` strategy block)

- **Hotspots first (highest ROI):** cross file **churn** (`git log --since=90.days --name-only`,
  count per file) with **complexity** (radon/lizard for Python, eslint complexity for TS). Debt in
  hot files charges interest daily; debt in cold files can wait. Target the intersection.
- **Complexity budget as the bar:** Law E thresholds (cyclomatic ≤ 10, cognitive ≤ 15, function
  ≤ 50 lines, file ≤ 300, params ≤ 5, nesting ≤ 4) are the existing repo standard — flag breaches,
  don't invent new thresholds. Waivers go to `.claude/state/complexity-waivers.md` with reasons.
- **Smell sweep (rotate a category per run):** duplication (jscpd) · dead code (vulture; knip /
  ts-prune) · god modules and long files · deep nesting and boolean-param APIs · confusing logic
  needing a comment to survive.
- **Deliberate-shortcut harvest:** run `ponytail-debt` (harvests `ponytail:` markers) plus a
  TODO/FIXME sweep; promote the ones now due.
- **Dependency debt:** unused/outdated packages (knip, `uv tree`), duplicate deps, majors pending.
- **Test debt:** flaky and slow tests, coverage gaps *in hotspot files*, mutation-score survivors
  (repo gate is ≥ 60%).
- **Prevention over cure:** when the same debt class recurs, propose the linter/CI rule that stops
  it (ruff/eslint rule enable, a custom Semgrep rule, a CI job). A GitHub Actions job or
  package-level lint config is a normal PR; anything touching `.claude/` hooks or
  `docs/standards/**` goes through advisor consult per harness governance.

### Docs mission — scope carefully

Human-facing docs should get someone productive fast: bullets, short sentences, diagrams, links to
code and to working pages in the app. Lead with human flows, then the technical detail supporting
each flow. Verbose prose that ignores the human reader will never be read — cut it. Find and fix
doc↔code drift; delete outdated pages rather than patching around them.

Hard boundaries:

- **Editable surface:** `README.md` and human-facing pages under `docs/` (excluding the paths
  below). Follow `.claude/rules/markdown.md`.
- **`docs/wiki/**` is generated by `/anatomy`** — never hand-edit; fix drift by running
  `/anatomy refresh <files>`, or file the gap if generation itself is wrong.
- **`docs/specs/weave/**` is the AI-facing spec** — deliberately detailed and verbose; do not
  "de-bloat" it. Cite contracts by ID from `contracts.md`; never restate endpoints by hand.
  Genuine spec↔code drift is *filed* (to the ledger, flagged for a human/spec-flow decision),
  not silently rewritten.
- **`docs/standards/**` and `CLAUDE.md` are harness-governed** — changes need the advisor-consult
  flow, and enforcement-core paths need human approval.
