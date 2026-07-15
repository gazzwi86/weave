import { TourSchema, type Tour } from "./schema";

const ceOverview: Tour = {
  tourId: "ce-overview",
  area: "constitution",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m1",
  steps: [
    { anchorId: "ce.overview", titleKey: "onboarding.tour.ce-overview.step1.title", bodyKey: "onboarding.tour.ce-overview.step1.body" },
    { anchorId: "ce.glossary", titleKey: "onboarding.tour.ce-overview.step2.title", bodyKey: "onboarding.tour.ce-overview.step2.body" },
    { anchorId: "ce.query", titleKey: "onboarding.tour.ce-overview.step3.title", bodyKey: "onboarding.tour.ce-overview.step3.body" },
    { anchorId: "ce.rules", titleKey: "onboarding.tour.ce-overview.step4.title", bodyKey: "onboarding.tour.ce-overview.step4.body" },
  ],
};

const geCanvas: Tour = {
  tourId: "ge-canvas",
  area: "explorer",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m1",
  steps: [
    { anchorId: "ge.canvas", titleKey: "onboarding.tour.ge-canvas.step1.title", bodyKey: "onboarding.tour.ge-canvas.step1.body" },
    { anchorId: "ge.canvas.spotlight-control", titleKey: "onboarding.tour.ge-canvas.step2.title", bodyKey: "onboarding.tour.ge-canvas.step2.body" },
  ],
};

const allPaths = ["business", "technical", "compliance", "admin"] as const;

// M2 -- completeness-map tour (EPIC-002, m2-delta.md §3).
const geCompletenessMap: Tour = {
  tourId: "tour.ge.completeness-map",
  area: "explorer",
  paths: [...allPaths],
  phase: "m2",
  steps: [
    { anchorId: "ge.overlay.controls", titleKey: "onboarding.tour.ge-completeness-map.step1.title", bodyKey: "onboarding.tour.ge-completeness-map.step1.body" },
    { anchorId: "ge.overlay.completeness-legend", titleKey: "onboarding.tour.ge-completeness-map.step2.title", bodyKey: "onboarding.tour.ge-completeness-map.step2.body" },
  ],
};

// M2 -- role-home guidance tour (EPIC-003, m2-delta.md §3).
const platRoleHome: Tour = {
  tourId: "tour.plat.role-home",
  area: "role-home",
  paths: [...allPaths],
  phase: "m2",
  steps: [
    { anchorId: "plat.role-home.nav-entry", titleKey: "onboarding.tour.plat-role-home.step1.title", bodyKey: "onboarding.tour.plat-role-home.step1.body" },
    { anchorId: "plat.role-home.capabilities", titleKey: "onboarding.tour.plat-role-home.step2.title", bodyKey: "onboarding.tour.plat-role-home.step2.body" },
    { anchorId: "plat.role-home.completeness-map", titleKey: "onboarding.tour.plat-role-home.step3.title", bodyKey: "onboarding.tour.plat-role-home.step3.body" },
    { anchorId: "plat.role-home.next-action", titleKey: "onboarding.tour.plat-role-home.step4.title", bodyKey: "onboarding.tour.plat-role-home.step4.body" },
    { anchorId: "plat.role-home.summary-tiles", titleKey: "onboarding.tour.plat-role-home.step5.title", bodyKey: "onboarding.tour.plat-role-home.step5.body" },
  ],
};

// M2 -- trust-mechanics tour: versions/diff/filters/overlays (EPIC-002, m2-delta.md §3).
const geTrustMechanics: Tour = {
  tourId: "tour.ge.trust-mechanics",
  area: "explorer",
  paths: [...allPaths],
  phase: "m2",
  steps: [
    { anchorId: "ge.overlay.controls", titleKey: "onboarding.tour.ge-trust-mechanics.step1.title", bodyKey: "onboarding.tour.ge-trust-mechanics.step1.body" },
    { anchorId: "ge.versions.panel", titleKey: "onboarding.tour.ge-trust-mechanics.step2.title", bodyKey: "onboarding.tour.ge-trust-mechanics.step2.body" },
    { anchorId: "ge.filters.governed-content", titleKey: "onboarding.tour.ge-trust-mechanics.step3.title", bodyKey: "onboarding.tour.ge-trust-mechanics.step3.body" },
  ],
};

// M2 -- rules & policies trust tour (EPIC-002, m2-delta.md §3).
// AC-004-05: proactive on Compliance + Technical only -- Business/Admin
// still reach this tour via the help launcher (help-launcher.tsx), which
// is not gated by `paths` (that field only drives availableTours()'s
// proactive-offer filter, per tour-content.ts).
const ceRulesPolicies: Tour = {
  tourId: "tour.ce.rules-policies",
  area: "constitution",
  paths: ["compliance", "technical"],
  phase: "m2",
  steps: [
    { anchorId: "ce.rules.shape-list", titleKey: "onboarding.tour.ce-rules-policies.step1.title", bodyKey: "onboarding.tour.ce-rules-policies.step1.body" },
    { anchorId: "ce.rules.violation-report", titleKey: "onboarding.tour.ce-rules-policies.step2.title", bodyKey: "onboarding.tour.ce-rules-policies.step2.body" },
  ],
};

export const TOURS: Tour[] = [ceOverview, geCanvas, geCompletenessMap, platRoleHome, geTrustMechanics, ceRulesPolicies].map((t) =>
  TourSchema.parse(t),
);
