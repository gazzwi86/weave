# H1 — State of the Art: Autonomous AI Coding "Dark Factories" and Agent Harnesses (2025–2026)

**Status:** Reference for the `.claude` harness refinement (2026-06-30)
**Scope note:** This is a *harness* report (H-series), distinct from the product research R0–R6.
**Author:** Harness-refinement research agent (background fan-out), web-sourced and skeptic-filtered.

---

A research brief for a spec→build harness. Scope: named projects (omnigent, Archon, openharness, harness-kit) plus six cross-cutting themes. Throughout, I separate **proven practice** (documented by vendors, widely reproduced, or grounded in primary engineering writeups) from **hype / unverified** (marketing pages, self-reported metrics, obscure repos). Where I could not verify a claim, I say so.

---

## Part 1 — Named projects

### omnigent (`omnigent-ai/omnigent`)

**Architecture.** Omnigent calls itself an open-source *meta-harness*: a common orchestration layer that sits **above** individual coding agents (Claude Code, Codex, Cursor, OpenCode, plus lesser-known "Hermes"/"Pi" and custom YAML-defined agents). Rather than being an agent, it standardises how you launch, govern, and observe agents from other vendors. Core pieces: (1) a harness abstraction so you can swap runtimes without rewriting; (2) a **policy engine** with spend caps, tool-access restrictions, and risk-based approval gates at server/agent/session scope; (3) cross-device session sync (terminal → browser → phone); (4) sandbox integrations (Modal, Kubernetes, E2B, Databricks). Python-primary (~83%), Apache-2.0, ~988 commits, self-labelled **alpha** ([repo](https://github.com/omnigent-ai/omnigent), [site](https://omnigent.ai/)).

**What's good.** The governance model — *broker credentials so the agent never sees them, cap spend, escalate risky actions for human approval* — is exactly the control plane a dark factory needs and is usually bolted on late. The "agent = model + harness, harness is swappable" framing is sound.

**Borrowable.** Treat policy/sandboxing/credential-brokering as a first-class layer, not per-agent config. Risk-based escalation (auto-approve cheap/reversible actions, pause on destructive ones) maps directly onto Weave's phase-gate HITL.

**Skeptic's note.** ~5.6k stars but **alpha**, single-vendor-ish, very young. The multi-harness abstraction is attractive but unproven at scale; treat as an idea source, not a dependency.

### Archon (`coleam00/archon`) — Cole Medin

**Architecture.** The most directly relevant project. Archon brands itself "the first open-source **harness builder** for AI coding," whose goal is to make AI coding **deterministic and repeatable**. Development processes are encoded as **YAML workflows** built from nodes; each node is either *deterministic* (bash, tests, git ops) or *AI-powered* (planning, codegen, review). A typical flow: plan → implement (with looping) → test-validate → code review → **approval gate** → PR. Notable mechanics: per-iteration **fresh context** (isolated sessions), **looping until completion criteria met**, dependency-ordered nodes, **git worktree isolation** for parallel runs, and interactive **human approval gates**. It ships ~19 bundled workflows and integrates Claude Code as primary, with Web/CLI/Slack/Telegram/GitHub-webhook adapters and MCP support ([repo](https://github.com/coleam00/archon), [writeup](https://joshuaberkowitz.us/blog/github-repos-8/archon-the-command-center-for-ai-coding-assistants-911)). Earlier Archon framing also emphasised RAG + project/task management ("an OS for AI coding").

**What's good.** The explicit deterministic-vs-AI node distinction is the key insight: pin the boring, verifiable steps (tests, lint, git) to code and reserve the model for genuinely open-ended steps. Worktree isolation + fresh-context-per-loop is a clean way to stop context rot and cross-task contamination.

**Borrowable.** Weave's `/implement` PDAC loop is already this shape; Archon validates the design and adds two refinements worth stealing: (a) **fresh context per task iteration** (Weave's "stop after N turns" cap pairs naturally with this), and (b) **deterministic nodes as gates** so a workflow can't advance unless tests/lint actually pass.

**Skeptic's note.** Self-reported "10x–100x" productivity is marketing, not evidence; ignore the number, keep the mechanics. Star counts vary across sources (~13k claimed) — directionally popular, exact figure unverified.

### openharness — **two different projects share the name**

This name is ambiguous; be precise about which you mean.
- **`HKUDS/OpenHarness`** (academic, HKU Data Science) — an open agent harness with a built-in personal agent ("Ohmo") that chats via Slack/Telegram/Discord/Feishu and can branch, code, test, and open PRs. Ships a toolkit of ~43 tools across File/Shell/Search/Web/MCP ([repo](https://github.com/HKUDS/OpenHarness)).
- **`openharness.ai` / `open-harness.dev`** — a *unified API across harnesses* ("write once, run on Anthropic SDK, Goose, LangChain, Letta, Claude Code"), with stateless primitives, composable middleware, and hierarchical subagents ([site](https://openharness.ai/), [dev](https://open-harness.dev/)).

**Borrowable.** The "stateless primitives + composable middleware + hierarchical subagents" decomposition (open-harness.dev) is a clean mental model for a harness library. The cross-harness portability goal overlaps with omnigent.

**Skeptic's note.** Low independent verification for both; mostly self-description. The portability-across-harnesses promise is appealing but historically leaky (each harness has real semantic differences in tools/permissions/memory). Treat as conceptual, not load-bearing.

### harness-kit / HarnessKit — **also two projects, both obscure**

- **`deepklarity/harness-kit`** — "a kit for building with AI agents… and the engineering patterns around it," advertising TDD-first execution, structured debugging, "knowledge compounding," and cost-aware delegation; declares plugins/skills/MCP/hooks in one `harness.yaml` ([repo](https://github.com/deepklarity/harness-kit), [site](https://harnesskit.ai/)).
- **`RealZST/HarnessKit`** — a cross-agent manager for skills, MCP servers, plugins, hooks, CLIs, configs, memory & rules (~284 stars) ([repo](https://github.com/RealZST/HarnessKit)).

**Borrowable.** The single-manifest idea (`harness.yaml` declaring skills + MCP + hooks + rules, portable across tools) is genuinely useful and mirrors what Weave already does informally in `.claude/`. A declarative manifest makes a harness reproducible and reviewable.

**Skeptic's note.** Both are small/early (hundreds of stars at most). Useful as design references for *configuration-as-data*; not adoptable infrastructure. The broader, better-sourced framing of "harness engineering" comes from Martin Fowler's site and Addy Osmani rather than these repos — cite those if you need authority ([Fowler](https://martinfowler.com/articles/harness-engineering.html), [Osmani](https://addyosmani.com/blog/agent-harness-engineering/)).

---

## Part 2 — Cross-cutting themes

### Claude Code best practices (long-running agents, subagents, hooks, headless, /goal, plan mode, output styles)

**What it is.** Anthropic's own guidance plus the product surface. **Subagents** are specialised assistants with their own system prompt, curated tool permissions, and **isolated context window** — used for parallel work or context isolation. **Hooks** (18+ events: PreToolUse, PostToolUse, Stop, SubagentStop, SessionStart/End…) are *deterministic* shell triggers that always run — the right place for hard rules (lint, format, block dangerous commands, gate progress). **Headless mode** runs Claude Code as a one-shot CLI without a TTY for CI/GitHub Actions/cron, reusing the same settings, hooks, and permissions as interactive. **Plan mode** explores without making edits. **Output styles** reshape the response contract. ([best practices](https://code.claude.com/docs/en/best-practices)).

**Why it matters.** This is the most *proven* layer here — it's the substrate Weave already runs on. The deterministic-hook / probabilistic-model split is the single most important reliability lever: anything that must always happen belongs in a hook, not a prompt.

**How it applies.** Weave's Stop-hook phase gates, `/goal …or stop after N turns` cap, and per-skill subagents are textbook applications. Headless mode is the bridge from interactive `/implement` to true unattended CI dark-factory runs.

### Multi-agent orchestration patterns

**What it is.** Anthropic's *Building Effective Agents* names five workflow patterns — **prompt chaining, routing, parallelization (sectioning + voting), orchestrator-workers, evaluator-optimizer** — and crucially distinguishes **workflows** (LLMs orchestrated through *predefined code paths*) from **agents** (LLMs *dynamically* directing their own process) ([essay](https://www.anthropic.com/research/building-effective-agents)). Their production **multi-agent research system** uses an orchestrator (Opus) spawning parallel Sonnet subagents; it beat single-agent Opus by **90.2%** on internal evals, but **token usage alone explained ~80% of performance variance** and the system burned **~15× the tokens** of a chat turn ([engineering writeup](https://www.anthropic.com/engineering/multi-agent-research-system)).

**Why it matters.** This is rigorously sourced and the headline guidance is *anti-hype*: "start simple; add agentic complexity only when it demonstrably improves outcomes." Multi-agent pays off for **open-ended, parallelisable, high-value** tasks (research, breadth-first exploration) and is wasteful for linear, well-specified ones.

**How it applies.** A spec→build dark factory is mostly **workflow**, not open-ended agent: the spec cascade (Brief→PRD→Roadmap→Tech Spec→Tasks) is prompt-chaining + routing with HITL gates. Reserve true orchestrator-worker fan-out for genuinely parallel work (e.g., independent tasks across worktrees, or breadth-first research like this very report). The **evaluator-optimizer** loop is the model for QA: generator writes code, evaluator (QA agent / tests / LLM-judge) scores, loop until pass. Budget awareness matters: multi-agent is 15× tokens — gate it behind value.

### Spec-driven development tooling (spec-kit, BMAD, OpenSpec, Kiro)

**What it is.** **GitHub spec-kit** turns specs into executable artifacts via slash commands: `/constitution` (governing principles, stored in `.specify/memory/`) → `/specify` (what/why) → `/clarify` (resolve ambiguity) → `/plan` (tech approach) → `/tasks` (ordered, parallel-markable) → `/analyze` (cross-artifact consistency) → `/implement`. Outputs `spec.md`, `plan.md`, `tasks.md`, plus data-model/API/quickstart docs; works across 30+ agents ([repo](https://github.com/github/spec-kit), [MS blog](https://developer.microsoft.com/blog/spec-driven-development-spec-kit)). **BMAD-Method** models a full agile *squad* (Analyst, PM, Architect, Dev agents) collaborating from idea to product. **OpenSpec** treats every change as a proposal needing approval ([comparison](https://arceapps.com/blog/sdd-frameworks-analysis-spec-kit-openspec-bmad/)).

**Why it matters.** These independently converged on the *same pipeline Weave already implements*. spec-kit's `/analyze` (consistency/coverage check across spec+plan+tasks before implement) is a step Weave approximates with `/spec-review` — strong validation that the gate belongs there.

**How it applies.** Weave is essentially a Weave-flavoured BMAD+spec-kit (PO/architect personas, brief→prd→roadmap→tech-spec→tasks, constitution-like CLAUDE.md + memory). Borrowable from spec-kit: an explicit **/analyze cross-artifact consistency gate** and **parallel-task markers** in task files so the implement loop knows what can fan out. Borrowable from OpenSpec: **change-as-proposal** framing for brownfield edits.

### Verification loops for generated UIs

**What it is.** Two layers. (1) **Playwright** functional + **visual** testing: `expect(page).toHaveScreenshot()` pixel-diffs against baselines in CI; element/full-page screenshots pinpoint layout/style regressions ([Playwright docs](https://playwright.dev/docs/test-snapshots)). (2) **Semantic / computer-use verification**: agents drive a real browser and use **vision** to judge whether a UI is actually correct (theme compliance, content hydration, "does the button do the thing"), which is more robust than brittle pixel-matching ([screenshot inspector skill](https://mcpmarket.com/tools/skills/playwright-screenshot-inspector)).

**Why it matters.** Generated UIs are the weakest link in a dark factory: code can compile and tests can pass while the screen is broken. Pixel-diff catches regressions but is brittle; vision-based checking closes the "looks right / works right" gap that unit tests can't see.

**How it applies.** Weave's Build Engine generates UIs; the verification loop should be: generate → Playwright click-through (functional) → screenshot → **vision check against the spec/design tokens** → feed failures back to the generator (evaluator-optimizer). Pin the deterministic parts (Playwright runs, screenshot capture) in hooks; reserve the model for the semantic judgment.

### AI-feature evaluation & hardening loops (eval-driven development)

**What it is.** Evals-as-tests for LLM features. **promptfoo** — open-source CLI/YAML, runs in GitHub Actions/GitLab/Jenkins, **gates deployments on eval results**. **Braintrust** — eval-first platform connecting production traces + structured evals + CI/CD gates. **LangSmith** — tracing-first, strongest inside the LangChain/LangGraph stack. The recurring pattern: a lightweight CLI framework for **CI gating** (promptfoo/DeepEval/RAGAS) **paired with** a platform for human annotation, regression tracking, and golden-dataset curation (Braintrust/LangSmith/Arize). The lifecycle: dev → automated CI quality gate → prod monitoring → human annotation feeds the golden set ([comparison](https://www.braintrust.dev/articles/best-ai-evals-tools-cicd-2025), [overview](https://inference.net/content/llm-evaluation-tools-comparison/)).

**Why it matters.** This is how you stop a generation harness from silently regressing. Anthropic's research system reinforces the method: **start with ~20 test cases** (small evals reveal big gains early), use **LLM-as-judge against a rubric** (factual/citation accuracy, completeness, source quality, tool efficiency), and prefer **end-state evaluation** (did it reach the right final state?) over scoring every intermediate step.

**How it applies.** Each generated artefact type (app, pipeline, agent) needs a small golden eval set that runs as a **CI gate** before a phase advances. Build the eval set *over time* from real failures (human annotation → golden set), exactly as Anthropic and Braintrust describe. promptfoo is the pragmatic starting point because it's free and CI-native.

### Phase-gated autonomy + HITL + stuck-loop recovery

**What it is.** The **Ralph loop** (Geoffrey Huntley) is the reference pattern: break a feature into phases (plan → implement → test → verify → PR), run each as an **independent loop with a fresh context**, with **human oversight at review boundaries, not every iteration** ([wiggum](https://wiggum.app/ralph-loop/), [asdlc](https://asdlc.io/patterns/ralph-loop/)). Stuck-loop defences: **iteration caps** (the "5-iteration HITL Ralph on a mechanical task" is the cheapest unit of work), fresh context per phase to shed accumulated confusion, and **retry/error-pattern detection** for transient failures. Anthropic's production lessons add **checkpoint-and-resume** (don't restart from scratch), **full tracing** for non-deterministic debugging, and **rainbow deployments** so updates don't break in-flight agents.

**Why it matters.** This is the difference between a demo and a factory. Bounded autonomy (cap turns, gate phases) + recoverability (checkpoints, fresh context) is what makes unattended runs safe. The maturity signal is *where* humans sit: at phase boundaries reviewing diffs, not babysitting tokens.

**How it applies.** Weave already implements the spine: `/goal … or stop after 60 turns`, Stop-hook `phase_gate()` → HITL approve/reject, `progress.json` state spine committed per task (that *is* checkpointing). Borrowable hardening: (a) **fresh context per task** (Ralph/Archon) to prevent drift across a long phase; (b) explicit **error-pattern detection** to auto-retry transient failures vs. halt-and-escalate on real ones; (c) end-state evals (not step-by-step) as the gate criterion.

---

## Top borrowable ideas (ranked)

1. **Deterministic-vs-AI node split (Archon).** Pin tests/lint/git/screenshot capture to code in hooks; reserve the model for open-ended steps. Single biggest reliability lever, and Weave's hook layer already supports it.
2. **Evaluator-optimizer as the QA loop + evals-as-CI-gates (Anthropic / promptfoo / Braintrust).** Per-artefact golden eval sets, LLM-as-judge on a rubric, end-state scoring, gating phase advance — built up over time from real failures.
3. **Fresh context per task iteration + checkpoint/resume (Ralph / Archon / Anthropic).** Shed drift between tasks; resume from `progress.json` rather than restart. Pairs with the existing turn cap.
4. **/analyze cross-artifact consistency gate (spec-kit).** A mechanical spec/plan/tasks coherence check before `/implement` — harden `/spec-review` toward this.
5. **Vision-based UI verification (Playwright + computer-use).** Generate → functional click-through → screenshot → vision check against design tokens → feedback loop. Closes the "compiles but broken screen" gap for the Build Engine.
6. **Policy/credential-brokering as a first-class layer (omnigent).** Risk-based escalation (auto-approve cheap/reversible, pause on destructive) + spend caps + hidden credentials, sitting above the agents.
7. **Declarative harness manifest (harness-kit).** Skills + MCP + hooks + rules as reviewable config-as-data, making the harness reproducible.

### Hype to discount
- Self-reported "10x–100x" productivity (Archon) and star counts across most named repos — directional at best, unverifiable.
- "Write once, run on any harness" portability (openharness, omnigent) — appealing but historically leaky; harnesses differ in real semantics. Don't make it load-bearing.
- omnigent/openharness/harness-kit are all **alpha/early/obscure**; mine them for patterns, not as dependencies. The well-sourced authorities are Anthropic's two essays, GitHub spec-kit, the Ralph-loop writeups, and Fowler/Osmani on harness engineering.
