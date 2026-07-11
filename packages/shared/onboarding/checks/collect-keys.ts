import type { Beacon, ChecklistItem, Exercise, Tour, TrainingEntry, WelcomeModal, WhatsNewItem } from "../content/schema";

export type ContentSet = {
  tours: Tour[];
  beacons: Beacon[];
  modals: WelcomeModal[];
  exercises: Exercise[];
  checklist: ChecklistItem[];
  training: TrainingEntry[];
  whatsNew: WhatsNewItem[];
};

function modalKeys(modals: WelcomeModal[]): string[] {
  const keys: string[] = [];
  for (const modal of modals) {
    keys.push(modal.titleKey, modal.bodyKey);
    for (const cta of modal.ctas) if (cta.kind !== "tour") keys.push(cta.labelKey);
  }
  return keys;
}

/** Pulls every `*Key` i18n-key field out of the M1 content set for the literal-string lint. */
export function collectKeys(input: ContentSet): string[] {
  return [
    ...input.tours.flatMap((tour) => tour.steps.flatMap((step) => [step.titleKey, step.bodyKey])),
    ...input.beacons.map((beacon) => beacon.bodyKey),
    ...modalKeys(input.modals),
    ...input.exercises.flatMap((exercise) => [exercise.goalKey, ...exercise.stepKeys]),
    ...input.checklist.flatMap((item) => [item.labelKey, item.whyKey]),
    ...input.training.flatMap((entry) => [entry.titleKey, entry.descriptionKey]),
    ...input.whatsNew.flatMap((item) => [item.titleKey, item.bodyKey]),
  ];
}
