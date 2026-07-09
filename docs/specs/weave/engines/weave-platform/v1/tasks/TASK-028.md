---
type: Task Brief
title: "Task: TASK-028 — Marketing entry gaps (real hero, missing IA sections, logo lockup)"
description: "Close the remaining gaps between the live marketing index (packages/frontend/app/
  page.tsx + components/marketing/**) and the approved IA (poc-ia-proposal.md §6): swap the CSS
  hero mock for a real product screenshot, add the two missing sections (social-proof strip,
  screenshot band), generate a full logo lockup asset, and move the page's composition onto a
  design-system landing-page template per the R13 atomic-design constraint. Adds a bare /login
  redirect as cheap insurance against F-D25's literal wording."
tags: [weave-platform, arch, task, v1, design-system, marketing, auth]
timestamp: 2026-07-09T00:00:00Z
status: Backlog
priority: Must Have
entity: weave-platform
epic: EPIC-012
milestone: v1
created: 2026-07-09
blocked_by: [TASK-026]
unlocks: []
adr_refs: []
---

# Task: TASK-028 — Marketing entry gaps (real hero, missing IA sections, logo lockup)

**Spec:** [weave-platform.md](../../../weave-platform.md) ·
**Design inputs:** [v1-design-requirements.md](../../../../../../design/v1-design-requirements.md),
[poc-ia-proposal.md](../../../../../../design/poc-ia-proposal.md) §6,
[visual-direction.md](../../../../../../design/visual-direction.md)

> **Scope traceability:** bundle R6 (`v1-design-requirements.md` R6), driven by
> `design-assessment-2026-07-09.md` findings F-D25 (Blocker — "Log in"/"Get started" route to
> `/login` -> 404) and F-D26 (Minor — hero is placeholder dots, not a product screenshot, and the
> page is missing sections the approved IA specifies). **Discovery made while grounding this brief
> against the live repo:** the marketing surface is not greenfield — `packages/frontend/app/
> page.tsx` already composes a public index from `components/marketing/{hero,features,
> pricing-footer,cta-link}.tsx`, and both CTAs (`CtaLink` in `hero.tsx`/`pricing-footer.tsx`)
> already navigate to `/auth/login` (which exists, renders, and signs in via `next-auth`'s
> `cognito` provider — mocked in dev/test per `app/auth/login/page.tsx`'s own comment). F-D25's
> literal claim ("routes to `/login` -> 404, CTAs dead") does not reproduce against current trunk;
> either it was fixed by uncatalogued work after the assessment ran, or the assessment inspected an
> older deploy. **This task does not re-litigate that — it records the discrepancy for QA to confirm
> closed, and scopes itself to the gaps that verifiably remain**: the hero is still a CSS mock (not
> a real screenshot, F-D26 confirmed by reading `hero.tsx`), the page has 7 of the IA's 9 sections
> (missing social-proof strip and screenshot band), the logo is a raw cropped PNG rather than a
> generated lockup asset, and the page composes marketing molecules directly in `app/page.tsx`
> rather than through a design-system template — the last one a real violation of the R13
> atomic-design constraint (`v1-design-requirements.md` R13: "app/container layer binds data ...
> never composes raw components"). A one-line bare-`/login` redirect is added regardless, as
> insurance against F-D25's literal URL even though `/auth/login` already satisfies the practical
> requirement.

## Story

**Epic:** EPIC-012 Marketing Site
**Priority:** Must Have

**As a** prospect landing on Weave's public page
**I want** the hero to show me the real product (not placeholder dots), every section the approved
plan promised, and a properly-rendered logo
**So that** I get an accurate first impression of the product and don't wonder whether the page is
finished or broken.

## Acceptance Criteria

| ID | EARS Criterion | Test Mapping |
|----|----------------|--------------|
| AC-1 | WHEN the marketing index renders, THE SYSTEM SHALL show a hero section whose visual is a real screenshot of the Explorer graph-canvas surface (a static image asset captured from the built app), replacing today's CSS `MockGraphPanel` placeholder — closing F-D26. | unit: `test_hero_uses_real_product_screenshot_asset` |
| AC-2 | WHEN the marketing index renders, THE SYSTEM SHALL present all nine sections fixed by `poc-ia-proposal.md` §6 in order — Header, Hero, Social-proof strip, How-it-works, Feature grid, Screenshot band, Pricing, Final CTA, Footer — adding the two sections not yet built (Social-proof strip, Screenshot band) alongside the five that already exist. | integration: `test_marketing_index_section_order_matches_ia` |
| AC-3 | WHEN the existing How-it-works, Feature grid, and Pricing sections are carried over into the rebuilt page, THE SYSTEM SHALL preserve their current content unchanged (3 steps Model/Ask & see/Generate; 6 cards — 4 engine + 2 platform; 3 tiers Starter/Team/Enterprise with Enterprise showing "Talk to us") — no regression while the surrounding sections/template change. | integration: `test_existing_sections_content_unchanged_after_template_refit` |
| AC-4 | WHEN the header or footer renders, THE SYSTEM SHALL use a full logo lockup variant (mark + wordmark, generated from `logo.png` as a distinct asset) — the raw padded PNG cropped by CSS height (today's `hero.tsx` behaviour) SHALL NOT appear on the marketing page. | unit: `test_marketing_uses_full_logo_lockup_variant` |
| AC-5 | WHEN the marketing page is composed, THE SYSTEM SHALL bind section content into a `landing-page` template added under the TASK-026 design system (`components/templates/landing-page.tsx`, accepting only a `sections` data prop), and `app/page.tsx` SHALL contain no direct JSX composition of marketing molecules — closing the current R13 atomic-design violation. | unit: `test_landing_page_template_added_before_binding_content` |
| AC-6 | WHEN any visitor navigates to the bare path `/login`, THE SYSTEM SHALL redirect (HTTP 307) to `/auth/login`, preserving any query string — closing F-D25's literal URL even though `/auth/login` itself already works. | E2E: `test_bare_login_redirects_to_auth_login` |
| AC-7 | WHEN a signed-out visitor clicks "Log in" or "Get started" on the marketing index, THE SYSTEM SHALL navigate to `/auth/login` without a full page reload — a regression-lock on the behaviour `components/marketing/cta-link.tsx` already implements today. | E2E: `test_marketing_ctas_navigate_to_auth_login` |

## Implementation

### Pseudocode

```text
# packages/frontend/next.config.ts — one redirect entry (AC-6)
redirects: [
  { source: "/login", destination: "/auth/login", permanent: false },  # preserves query string by default
]

# packages/frontend/components/templates/landing-page.tsx (new, design-system layer, data-only props)
function LandingPageTemplate({ sections }):
  assert sections.map(s => s.kind) == [
    "header", "hero", "social-proof", "how-it-works",
    "feature-grid", "screenshot-band", "pricing", "final-cta", "footer",
  ]  # AC-2: fixed order, enforced structurally, not by convention alone
  return render(sections)  # each section is an existing components/marketing/* molecule, or new to this task

# packages/frontend/app/page.tsx — becomes a thin binder (AC-5)
function Home():
  return <LandingPageTemplate sections={MARKETING_SECTIONS} />  # no direct molecule JSX here anymore

# components/marketing/hero.tsx — replace MockGraphPanel (AC-1)
function Hero():
  # was: <MockGraphPanel /> (five CSS dots, aria-hidden)
  return <img src="/marketing/hero-canvas.png" alt="Weave Explorer graph canvas" ... />
  # captured once TASK-027's chrome refit lands, so the screenshot shows v2 chrome not the pre-refit shell
```

### API Contracts

N/A — static/public marketing surface, no data API. `/auth/login`'s sign-in action is the existing
`next-auth` `cognito` provider wired in TASK-002 (M1); this task adds no new auth endpoint or
session mechanism, only a redirect rule and static content/asset changes.

### Diagram References

| Diagram | File | Relevant Section | Summary |
|---------|------|-------------------|---------|
| Sequence | N/A | N/A | No sequence — static page render, one server-side redirect rule, and existing CTA client navigations. |
| State | N/A | N/A | No new state — `/auth/login`'s own render branches are out of this task's scope (pre-existing, TASK-002). |
| Data Model | N/A | N/A | No data model — all content is static copy/image assets, no persisted entities. |

### Design Decisions

| Decision | Reference | Impact on This Task |
|----------|-----------|----------------------|
| Marketing section order is fixed and normative | [poc-ia-proposal.md](../../../../../../design/poc-ia-proposal.md) §6 "Marketing index" | Defines AC-2's nine-section order and the `LandingPageTemplate` structural assertion; 5 of 9 sections already exist and must not be reordered by this task |
| `/auth/login` is the canonical sign-in route; a bare `/login` redirect is added as insurance, not a rebuild | Discovery made grounding this brief (see scope-traceability) + F-D25's literal wording | AC-6/AC-7; this task does not rebuild login, it only regression-locks the existing CTA behaviour and closes the literal bare-URL gap cheaply |
| Full logo lockup vs cropped mark are two distinct generated assets from one source | [visual-direction.md](../../../../../../design/visual-direction.md) "Logo" | AC-4; marketing uses the lockup, TASK-027's in-app chrome uses the cropped mark — same source file, different generated variant, never interchange them |
| New page-level layout requires a design-system template first | [v1-design-requirements.md](../../../../../../design/v1-design-requirements.md) R13 atomic-design constraint | AC-5; `landing-page` is a new template (marketing pages weren't in R13's initial four-template list: canvas-page/table-page/form-drawer-page/dashboard-grid), and today's `app/page.tsx` composing molecules directly is the exact anti-pattern R13 forbids |

### Design requirements

- Hero visual = real product screenshot of the graph-canvas (Explorer) surface — cites F-D26
  directly and the marketing JTBD success criterion in `jtbd.md` ("hero with a real product
  visual (graph canvas)").
- Nine-section order per `poc-ia-proposal.md` §6 — cited above; this is the single normative
  source, not a paraphrase.
- Full logo lockup (not the cropped in-app mark) on the marketing page — cites `visual-direction.md`
  "Logo" requirement directly.
- `landing-page` template lives in the design system, not as page-local markup — cites R13's
  atomic-design constraint ("missing layout ⇒ add the template to the system first").
- Advisory: the hero screenshot (AC-1) and the two screenshot-band captures (AC-2) are real captures
  the engineer must take from the built app once TASK-027 lands — no F-D/R citation pins *which*
  exact app state to capture; flag for a design review pass once TASK-027 refits the chrome, so the
  marketing screenshots show the v2 shell, not the pre-refit one.
- Advisory: no F-D/R citation asks for a distinct "signup" flow (`?intent=signup` or similar) — this
  is an invite-only, single-tenant-per-company product with no self-serve signup path, so both CTAs
  reasonably point to the same sign-in route. Earlier drafts of this brief invented an
  `intent=signup` query-param distinction; it is dropped as unrequested scope (YAGNI) unless product
  confirms a real signup flow exists to differentiate.

## Test Requirements

### Unit Tests (minimum 3)

- `should render the hero section with a real screenshot asset, not the CSS MockGraphPanel`
- `should render the header and footer with the full logo lockup asset, never the raw cropped PNG`
- `should render the landing-page template with all nine sections present in the fixed order`

### Integration Tests (minimum 2)

- `should assemble the marketing index from the landing-page template with all nine section kinds present and correctly ordered`
- `should preserve How-it-works/Feature-grid/Pricing content unchanged after the template refit`

### E2E Tests (minimum 2)

- `should redirect a visitor from bare /login to /auth/login, preserving query string`
- `should click Log in or Get started on the marketing index and land on /auth/login without a full reload`

### AC-to-Test Mapping

| AC | Test Type | Test Name |
|----|-----------|-----------|
| AC-1 | Unit | `test_hero_uses_real_product_screenshot_asset` |
| AC-2 | Integration | `test_marketing_index_section_order_matches_ia` |
| AC-3 | Integration | `test_existing_sections_content_unchanged_after_template_refit` |
| AC-4 | Unit | `test_marketing_uses_full_logo_lockup_variant` |
| AC-5 | Unit | `test_landing_page_template_added_before_binding_content` |
| AC-6 | E2E | `test_bare_login_redirects_to_auth_login` |
| AC-7 | E2E | `test_marketing_ctas_navigate_to_auth_login` |

## Dependencies

- **blocked_by:** [TASK-026] — the `landing-page` template comes from the TASK-026 design system;
  the existing marketing molecules (`hero.tsx`, `features.tsx`, `pricing-footer.tsx`, `cta-link.tsx`)
  are folded into it, not rebuilt.
- **unlocks:** [] — no other v1 task depends on the marketing page; it is a leaf surface.

## Cost Estimate

- **Complexity:** S
- **Estimated tokens:** ~24K input, ~10K output
- **Estimated cost:** ~$1.50
- **Note:** downgraded from the original M-sized estimate — grounding this brief against the live
  repo found roughly half the originally-scoped work (login page, CTA wiring, 5 of 9 sections)
  already built; this brief now covers only the verified remaining gap.

## Definition of Ready Checklist

- [x] User story clear
- [x] All AC have mapped tests
- [x] Pseudocode provided (redirect rule, template extraction, hero asset swap)
- [x] API contracts defined (N/A — static page; existing auth flow bound, reasoned)
- [x] Diagram references included (N/A rows, reasoned)
- [x] Design decisions noted
- [x] Test scenarios specified with types and counts
- [x] Dependencies defined (blocked_by and unlocks)
- [x] Cost estimate provided

## Definition of Done Checklist

- [ ] All AC met
- [ ] All specified tests passing
- [ ] Coverage >= 80% for changed code
- [ ] Lint passes (zero errors)
- [ ] Complexity within thresholds (cyclomatic <= 10, cognitive <= 15, fn <= 50 lines)
- [ ] JSDoc / prop docs on public APIs
- [ ] Conventional commit(s) created
- [ ] No implementation beyond the task brief's AC and pseudocode (YAGNI)
- [ ] PR references this task and parent epic

## Implementation Hints

- Before writing any code, click through the live marketing page and `/auth/login` yourself — this
  brief's scope-traceability section documents a real discrepancy with the F-D25/F-D26 findings
  that shaped it (CTAs already work). Confirm current behaviour first; if something regressed since
  this brief was written, the gap is bigger than scoped here and worth flagging back before starting.
- Screenshot assets (hero, 2x screenshot-band) are static files checked into
  `packages/frontend/public/marketing/` — capture them once TASK-027 (chrome) is far enough along
  that they show the v2 shell, not the pre-refit one.
- Social-proof strip content (logos/quote) has no real customer data to draw on yet (pre-launch
  product) — use placeholder/generic copy consistent with the Pricing section's existing "dummy
  tiers" treatment; do not fabricate real customer names or logos.
- `# ponytail: social-proof content is placeholder copy, not real customer logos — swap in real
  ones only once product has actual customers to name.`
- Reuse TASK-026's card/button atoms for the two new sections; do not hand-roll new card markup.

---

*Generated by Weave Architect skill (arch-task-brief). Self-contained — engineer reads only this file.*
