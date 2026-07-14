import { TrainingEntrySchema, type TrainingEntry } from "./schema";

/** v1 ships placeholder cards only -- no `videoId` yet (ADR-006). */
const entries: TrainingEntry[] = [
  {
    trainingId: "getting-started",
    titleKey: "onboarding.training.getting-started.title",
    descriptionKey: "onboarding.training.getting-started.description",
  },
  {
    trainingId: "explorer-basics",
    titleKey: "onboarding.training.explorer-basics.title",
    descriptionKey: "onboarding.training.explorer-basics.description",
  },
  // M2 -- deep-link target for checklist.add-competency-questions (m2-delta.md §4).
  {
    trainingId: "declare-competency-questions",
    titleKey: "onboarding.training.declare-competency-questions.title",
    descriptionKey: "onboarding.training.declare-competency-questions.description",
  },
];

export const TRAINING_ENTRIES: TrainingEntry[] = entries.map((t) => TrainingEntrySchema.parse(t));
