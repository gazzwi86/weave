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
    signalRefs: ["CE-02"],
  },
  {
    itemId: "first-commit",
    paths: ["business", "technical", "admin"],
    phase: "m1",
    labelKey: "onboarding.checklist.first-commit.label",
    whyKey: "onboarding.checklist.first-commit.why",
    deepLink: "/ce/overview",
    autoCompleteOn: "exercise_complete",
    // ponytail: technical's raw-SPARQL exercise (CE-03) and the guided
    // write-commit equivalent (CE-03b) both satisfy "first commit" here.
    signalRefs: ["CE-03", "CE-03b"],
  },
  {
    itemId: "explore-canvas",
    paths: [...allPaths],
    phase: "m1",
    labelKey: "onboarding.checklist.explore-canvas.label",
    whyKey: "onboarding.checklist.explore-canvas.why",
    deepLink: "/explorer",
    autoCompleteOn: "tour_complete",
    signalRefs: ["ge-canvas"],
  },
  {
    // AC-010-02: business/technical only -- those are the only paths with
    // a poller-detected milestone today (recorder.py's MILESTONE_ID_BY_PATH).
    // compliance/admin have no detector seam built in this slice, so
    // listing this item for them would promise an auto-complete that can
    // never fire.
    itemId: "first-activation",
    paths: ["business", "technical"],
    phase: "m1",
    labelKey: "onboarding.checklist.first-activation.label",
    whyKey: "onboarding.checklist.first-activation.why",
    deepLink: "/ce/overview",
    autoCompleteOn: "activation_milestone",
    signalRefs: ["first_committed_entity"],
  },
  {
    // AC-010-03 / OQ-08: no PLAT-IDENTITY-1 poller signal exists -- manual
    // self-mark only, badged "pending" until marked.
    itemId: "invite-admin",
    paths: ["admin"],
    phase: "m1",
    labelKey: "onboarding.checklist.invite-admin.label",
    whyKey: "onboarding.checklist.invite-admin.why",
    deepLink: "/settings",
    autoCompleteOn: "manual",
    signalRefs: ["invite_admin"],
    badge: "pending-platform-signal",
  },
  {
    // AC-010-03: PLAT-CONNECTOR-1 is v1.0, not shipped in M1 -- locked.
    // `lockedUntilPhase` only distinguishes m1/m2/post-v1; "post-v1" is
    // the closest available value to "not in this milestone's build".
    itemId: "connect-source",
    paths: ["admin"],
    phase: "m1",
    labelKey: "onboarding.checklist.connect-source.label",
    whyKey: "onboarding.checklist.connect-source.why",
    deepLink: "/settings",
    autoCompleteOn: "manual",
    lockedUntilPhase: "post-v1",
  },
];

export const CHECKLIST_ITEMS: ChecklistItem[] = items.map((i) => ChecklistItemSchema.parse(i));
