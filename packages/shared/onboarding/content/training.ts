import { TrainingEntrySchema, type TrainingEntry } from "./schema";

/** v1 ships one playable placeholder (ADR-006's CloudFront shape, still no
 * uploaded rendition) and one written walkthrough; the rest are
 * "coming soon" placeholder cards. */
const entries: TrainingEntry[] = [
  {
    trainingId: "getting-started",
    titleKey: "onboarding.training.getting-started.title",
    descriptionKey: "onboarding.training.getting-started.description",
    category: "introduction",
    writtenWalkthroughUrl: "onboarding.training.getting-started.walkthrough",
    walkthroughBodyKey: "onboarding.training.getting-started.walkthrough-body",
  },
  {
    trainingId: "explorer-basics",
    titleKey: "onboarding.training.explorer-basics.title",
    descriptionKey: "onboarding.training.explorer-basics.description",
    category: "graph-explorer",
    videoId: "explorer-basics-01",
    durationSeconds: 245,
  },
  // M2 -- deep-link target for checklist.add-competency-questions (m2-delta.md §4).
  {
    trainingId: "declare-competency-questions",
    titleKey: "onboarding.training.declare-competency-questions.title",
    descriptionKey: "onboarding.training.declare-competency-questions.description",
    category: "ontologies",
  },
];

export const TRAINING_ENTRIES: TrainingEntry[] = entries.map((t) => TrainingEntrySchema.parse(t));
