import { ChecklistItemSchema, type ChecklistItem } from "./schema";

const allPaths = ["business", "technical", "compliance", "admin"] as const;

const items: ChecklistItem[] = [
  {
    itemId: "visit-demo",
    paths: [...allPaths],
    phase: "m1",
    labelKey: "onboarding.checklist.visit-demo.label",
    whyKey: "onboarding.checklist.visit-demo.why",
    deepLink: "/ce/overview",
    autoCompleteOn: "demo_visit",
  },
  {
    itemId: "first-query",
    paths: [...allPaths],
    phase: "m1",
    labelKey: "onboarding.checklist.first-query.label",
    whyKey: "onboarding.checklist.first-query.why",
    deepLink: "/ce/query",
    autoCompleteOn: "exercise_complete",
  },
  {
    itemId: "first-commit",
    paths: ["business", "technical", "admin"],
    phase: "m1",
    labelKey: "onboarding.checklist.first-commit.label",
    whyKey: "onboarding.checklist.first-commit.why",
    deepLink: "/ce/overview",
    autoCompleteOn: "exercise_complete",
  },
  {
    itemId: "explore-canvas",
    paths: [...allPaths],
    phase: "m1",
    labelKey: "onboarding.checklist.explore-canvas.label",
    whyKey: "onboarding.checklist.explore-canvas.why",
    deepLink: "/explorer",
    autoCompleteOn: "tour_complete",
  },
  // M2 -- competency-question guidance (m2-delta.md §4/§5, OQ-M2-1 amended: manual self-mark,
  // zero schema change -- CE ships no per-tenant count to auto-clear against).
  {
    itemId: "add-competency-questions",
    paths: ["business", "technical"],
    phase: "m2",
    labelKey: "onboarding.checklist.add-competency-questions.label",
    whyKey: "onboarding.checklist.add-competency-questions.why",
    deepLink: "/training/declare-competency-questions",
    autoCompleteOn: "manual",
  },
];

export const CHECKLIST_ITEMS: ChecklistItem[] = items.map((i) => ChecklistItemSchema.parse(i));
