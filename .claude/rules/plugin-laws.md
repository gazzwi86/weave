# Plugin Laws (universal quality gates)

These six laws apply to every Weave-generated project and every harness agent. No agent, skill,
or task may suppress them. This file is the single source — agent files reference it rather than
restating it.

- **Law A — Common-stack first.** Default to the confirmed Weave stack (`CLAUDE.md` §Stack) and
  tool equivalents from `docs/stack-equivalents.md`. Exotic additions require explicit written
  user acknowledgement of bus-factor risk in the PRD.
- **Law B — Functional, automation-tested.** UI-bearing projects pass real browser-automated E2E
  (Playwright default; Selenium/Cypress/Puppeteer where the brief mandates) that also asserts
  backend state changed. Non-UI projects pass integration tests invoking the produced binary/infra
  against local emulators.
- **Law C — Council-graded quality.** Enterprise-grade claims require a 5-persona council review
  (product, security, architecture, engineering, QA, end-user, executive) with aggregate ≥ 4.0/5
  and zero Blocker findings.
- **Law D — Stacked PRs by construction.** One PR per phase; multiple small commits per PR;
  PR N+1 branches off PR N.
- **Law E — Complexity as a budget.** Thresholds: cyclomatic ≤ 10, cognitive ≤ 15, function
  ≤ 50 lines, file ≤ 300 lines, params ≤ 5, nesting ≤ 4. Waivers require non-empty reason strings
  logged to `.claude/state/complexity-waivers.md`.
- **Law F — Synthetic verification, no cloud spend.** Tests never deploy to real cloud accounts.
  IaC verified via synthesis + static analysis; runtime via local emulators (LocalStack, Azurite,
  Cosmos emulator, Testcontainers).
