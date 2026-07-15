import type { ChecklistItem, Phase } from "./content/schema";

/** TASK-010 AC-010-02: the bootstrap signal rows the checklist derives
 * from -- shaped off `OnboardingStateOut` (backend), kept as a local
 * structural type so this package stays dependency-free of the backend.
 */
export interface ChecklistSignals {
  sandboxWorkspaceId: string | null;
  sandboxForkedAt: string | null;
  tours: { tour_id: string; completed_at: string | null }[];
  exerciseCompletions: { exercise_id: string; completed_at: string }[];
  activations: { milestone_id: string; activated_at: string; source: string }[];
}

export interface DerivedChecklistItem {
  item: ChecklistItem;
  checked: boolean;
  completedAt: string | null;
  locked: boolean;
  badge: ChecklistItem["badge"];
}

export interface DerivedChecklist {
  items: DerivedChecklistItem[];
  allComplete: boolean;
}

/** One signal instance a `signalRefs` id can match, keyed by
 * `autoCompleteOn` kind -- keeps `deriveOne` a flat lookup, not a branchy
 * matcher (Law E: cyclomatic budget).
 */
function demoVisitTimestamp(signals: ChecklistSignals): string | null {
  return signals.sandboxWorkspaceId !== null ? signals.sandboxForkedAt : null;
}

function tourCompleteTimestamp(refs: string[], signals: ChecklistSignals): string | null {
  const tour = signals.tours.find((t) => refs.includes(t.tour_id) && t.completed_at !== null);
  return tour?.completed_at ?? null;
}

function exerciseCompleteTimestamp(refs: string[], signals: ChecklistSignals): string | null {
  const exercise = signals.exerciseCompletions.find((e) => refs.includes(e.exercise_id));
  return exercise?.completed_at ?? null;
}

function activationTimestamp(refs: string[], signals: ChecklistSignals): string | null {
  const activation = signals.activations.find((a) => refs.includes(a.milestone_id));
  return activation?.activated_at ?? null;
}

/** One signal instance a `signalRefs` id can match, keyed by
 * `autoCompleteOn` kind -- keeps this a flat dispatch, not a branchy
 * matcher (Law E: cyclomatic budget).
 */
function signalTimestamp(item: ChecklistItem, signals: ChecklistSignals): string | null {
  const refs = item.signalRefs ?? [];
  switch (item.autoCompleteOn) {
    case "demo_visit":
      return demoVisitTimestamp(signals);
    case "tour_complete":
      return tourCompleteTimestamp(refs, signals);
    case "exercise_complete":
      return exerciseCompleteTimestamp(refs, signals);
    case "activation_milestone":
    case "manual":
      return activationTimestamp(refs, signals);
    default:
      return null;
  }
}

function deriveOne(
  item: ChecklistItem,
  signals: ChecklistSignals,
  currentPhase: Phase
): DerivedChecklistItem {
  const locked = item.lockedUntilPhase !== undefined && item.lockedUntilPhase !== currentPhase;
  const completedAt = locked ? null : signalTimestamp(item, signals);
  const checked = completedAt !== null;
  return { item, checked, completedAt, locked, badge: checked ? undefined : item.badge };
}

/** AC-010-02: detection and widget can never disagree -- both read these
 * same signal rows, so this is the single place completion is decided.
 * AC-010-04: a locked item never blocks the 100%/celebration gate.
 */
export function deriveChecklist(
  items: ChecklistItem[],
  signals: ChecklistSignals,
  currentPhase: Phase = "m1"
): DerivedChecklist {
  const derived = items.map((item) => deriveOne(item, signals, currentPhase));
  const allComplete = derived.every((d) => d.locked || d.checked);
  return { items: derived, allComplete };
}

/** ONB-V1-TASK-003 AC-003-03/04: pure "is this checklist item still
 * asking for action" check, reusing `deriveChecklist` (single source of
 * truth -- AC-010-02) rather than a second lock/checked matcher. Drives
 * beacon visibility: `visible = item.open && anchor.shipped && anchor.present`. */
export function isChecklistItemOpen(
  itemId: string,
  items: ChecklistItem[],
  signals: ChecklistSignals,
  rolePath: ChecklistItem["paths"][number],
  currentPhase: Phase
): boolean {
  const item = items.find((i) => i.itemId === itemId && i.paths.includes(rolePath));
  if (!item) return false;
  const [derived] = deriveChecklist([item], signals, currentPhase).items;
  return derived !== undefined && !derived.locked && !derived.checked;
}

/** AC-010-04: default-7-days-tunable auto-dismiss window arithmetic,
 * kept pure/testable separate from the widget's effect that calls it.
 */
export function shouldAutoDismiss(completedAt: Date | string, now: Date, windowDays: number): boolean {
  const completedMs = new Date(completedAt).getTime();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  return now.getTime() - completedMs >= windowMs;
}
