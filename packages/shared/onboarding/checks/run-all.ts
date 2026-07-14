import { TOURS } from "../content/tours";
import { BEACONS } from "../content/beacons";
import { WELCOME_MODALS } from "../content/modals";
import { EXERCISES } from "../content/exercises";
import { CHECKLIST_ITEMS } from "../content/checklist";
import { TRAINING_ENTRIES } from "../content/training";
import { WHATS_NEW_ITEMS } from "../content/whats-new";
import { checkDeadCtas } from "./dead-cta";
import { checkCopyBudgets } from "./copy-budget";
import { checkExerciseRoleSplit } from "./tag-presence";
import { checkKeysAreRegistered } from "./key-format";
import { collectKeys } from "./collect-keys";

/** Runs every content-config CI check against the real M1 content set. */
export function runAllContentChecks(): string[] {
  return [
    ...checkDeadCtas(WELCOME_MODALS, TOURS),
    ...checkCopyBudgets(TOURS, BEACONS),
    ...checkExerciseRoleSplit(EXERCISES),
    ...checkKeysAreRegistered(
      collectKeys({
        tours: TOURS,
        beacons: BEACONS,
        modals: WELCOME_MODALS,
        exercises: EXERCISES,
        checklist: CHECKLIST_ITEMS,
        training: TRAINING_ENTRIES,
        whatsNew: WHATS_NEW_ITEMS,
      }),
    ),
  ];
}
