# Phase Gate: {{PHASE_NAME}}

## Gate Criteria

**Phase:** {{Phase number and name}}
**Triggered:** {{When this gate fires -- e.g., after all Phase 1 stories complete}}
**Approver:** Human (HITL)

## Checklist

### Deliverables
- [ ] All stories in phase marked Done
- [ ] All tests passing (unit, integration, E2E)
- [ ] Test coverage meets threshold (>= 80%)

### Quality
- [ ] No lint errors
- [ ] Complexity within thresholds
- [ ] QA review complete for all stories
- [ ] No unresolved failure reports
- [ ] Mutation score >= 70% (Stryker report attached)

### Artifacts
- [ ] PRs created and reviewable
- [ ] Commits follow conventional format
- [ ] Documentation updated

### Environment
- [ ] App runs locally (`npm run dev`)
- [ ] Test suite runs (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] {{Phase-specific criteria, e.g., "API routes respond correctly"}}

## Cost Summary

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Total tokens (input) | {{N}}K | {{N}}K |
| Total tokens (output) | {{N}}K | {{N}}K |
| Total cost | ${{N}} | ${{N}} |
| Variance | — | {{+/-}}% |

## Decision

- [ ] **Approve** -- proceed to next phase
- [ ] **Amend** -- address specific items before proceeding
- [ ] **Reject** -- significant rework needed

## Notes

{{Human notes from review}}

---
*HITL gate template. This file is created per phase and reviewed by the human approver.*
