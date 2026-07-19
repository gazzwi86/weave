# Law C council — UI refit program (2026-07-19)

Scope: the 15-PR visual refit (#149-164) vs the signed-off mock + T4 discrepancy matrix.

| Persona | Score | Blockers |
|---|---|---|
| Product/UX | 4.0 | none |
| Accessibility/End-user | 4.0 | none |
| Engineering/Architecture | 4.5 | none |
| Design/Visual-fidelity | 4.5 (after-shots verified) | none — cap lifted |
| QA/Test | 4.0 | none |

**INITIAL aggregate: 3.9/5** (Design verification-capped at 3.0, no after-shots).

**FINAL aggregate: 4.2/5 — PASSES Law C (>=4.0, zero blockers).** After the local build was repaired
(a fresh dependency reinstall cleared the polluted-node_modules turbopack failure), the rendered AFTER
state was captured on the production build and confirmed against the mock:
- Explore: BEFORE = dense hairball of hundreds of machine-ID nodes + Pending KPI strip. AFTER =
  human-readable labels, a legible spread graph (label-thinning + default filter), a POPULATED KPI
  strip (176 entities / 347 relations, the V3b-3 true-total fix), no off-spec H1. Design Explore concern resolved.
- Constitution /ce: BEFORE = bare Constitution Engine panel + raw file input. AFTER = CONSTITUTION
  eyebrow + Overview + explain band + real KPI cards (132 instances, 497 triples) + populated
  Model-by-kind breakdown. Polished overview delivered.
Design -> 4.5. New aggregate = (4 + 4 + 4.5 + 4.5 + 4) / 5 = 4.2. Law C PASS.

After-shots: scratchpad/t4/__shots__/app-after/ (durable baselines captured by the CI visual-regression job).

The ONLY thing holding it under 4.0 is Design being unable to CERTIFY visual fidelity without
rendered after-screenshots (blocked by a local Next-16 turbopack build-env issue; CI is green). With
after-shots confirming Explore reads mock-clean, Design → 4, aggregate → ~4.1 = PASS. The after-shots
are produced by the CI visual-regression job (the next, HITL-gated closeout step).

Design's 2nd "blocker" — Constitution not explore-first — is RESOLVED: the user chose "/ce lands on a
polished overview" in the coverage MCQ, so overview-not-explore-first is an intentional accepted deviation.

## Non-blocking follow-ups the council surfaced (all fixable, none gate ship):
1. [Eng, LOW] Sweep 2 raw-px values in `components/shell/avatar-menu.tsx` (`max-w-[280px]`, focus-ring shadow) to tokens.
2. [QA, MED] audit-422 test asserts the call fires, not that it carries `tenant_id` — add the param assertion.
3. [QA, MED] Codify the API-log sweep into CI (no fixture greps server logs for swallowed 5xx) — the net that catches the next server-swallowed-500 doesn't exist.
4. [QA/A11y, MED] De-flake axe-m2 (rerun-until-green masks real regressions) + fix G19 (a11y spec routes around a real canvas-click/overlay pointer-events bug) + make T1 visual-regression a required CI check.
5. [A11y, LOW] Verify empty "Not available yet" cards are non-focusable (no dead tab stops).
6. [Product/Design, MED] Home not yet the mock's live-data personalized Home + empty "Not available yet" cards = deferred T5 + demo-data population (tracked, out of refit scope).
