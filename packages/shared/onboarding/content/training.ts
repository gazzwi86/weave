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
];

export const TRAINING_ENTRIES: TrainingEntry[] = entries.map((t) => TrainingEntrySchema.parse(t));
