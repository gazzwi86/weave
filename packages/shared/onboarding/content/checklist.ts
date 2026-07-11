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
];

export const CHECKLIST_ITEMS: ChecklistItem[] = items.map((i) => ChecklistItemSchema.parse(i));
