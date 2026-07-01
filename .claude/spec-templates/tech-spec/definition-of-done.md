# Definition of Done

A task is complete when ALL of the following are true:

## Code Quality

- [ ] All acceptance criteria met
- [ ] All specified tests written and passing
- [ ] Test coverage >= 80% for changed code
- [ ] No lint errors (ESLint + SonarJS pass)
- [ ] Cyclomatic complexity <= 10 per function
- [ ] Cognitive complexity <= 15 per function
- [ ] JSDoc on all public functions/components
- [ ] No TODO/FIXME/HACK comments left unresolved
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)

## Tests

- [ ] Unit tests: all specified scenarios pass
- [ ] Integration tests: all specified scenarios pass
- [ ] E2E tests: all specified scenarios pass
- [ ] Edge cases from QA review covered
- [ ] No flaky tests introduced

## Git

- [ ] Commits follow conventional commit format
- [ ] Each commit is a logical unit of work
- [ ] PR created with description referencing epic/story
- [ ] PR is reviewable (small enough to understand)

## Documentation

- [ ] JSDoc on new/modified public APIs
- [ ] README updated if user-facing behavior changed
- [ ] ADR created if architectural decision was made

## QA Review

- [ ] QA agent validates against acceptance criteria
- [ ] QA agent validates against user story intent
- [ ] QA agent checks against relevant sequence/state diagrams
- [ ] QA agent confirms design decisions were followed
- [ ] QA extends tests for uncovered edge cases

---
*Opinionated DoD from Weave. Customize per project in docs/specs/weave/engines/<entity>/04-arch/tech-spec/definition-of-done.md*
