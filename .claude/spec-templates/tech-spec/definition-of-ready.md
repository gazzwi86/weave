# Definition of Ready

A task is ready for the Engineer agent when ALL of the following are true:

## Required in Task Brief

- [ ] User story with clear "As a / I want / So that" format
- [ ] Acceptance criteria (each maps 1:1 to at least one test)
- [ ] Pseudocode or implementation approach
- [ ] API contracts (if applicable) -- endpoint, request/response schemas
- [ ] Diagram references with summaries (sequence, state, ERD as relevant)
- [ ] Design decisions that affect this task (with ADR references)
- [ ] DoD checklist specific to this task

## Test Requirements Specified

- [ ] Explicit test scenarios listed by name
- [ ] Test type requirements (minimum unit/integration/E2E counts)
- [ ] AC-to-test mapping table
- [ ] Edge cases identified

## Context Available

- [ ] Relevant spec sections identified (file refs + summaries)
- [ ] Dependencies on other tasks noted
- [ ] Implementation hints provided (patterns to follow, pitfalls to avoid)

## Scaffolding Complete

- [ ] Project boilerplate set up (or this IS a scaffolding task)
- [ ] Test framework configured and runnable
- [ ] Linting rules active
- [ ] CI pipeline configured (or documented as future work)

---
*Opinionated DoR from Weave. Customize per project in .claude/specs/<entity>/04-arch/tech-spec/definition-of-ready.md*
