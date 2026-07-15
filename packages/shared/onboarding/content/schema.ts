import { z } from "zod";
import { anchorIds, type AnchorId } from "../anchors";

/** `z.enum` needs a non-empty tuple; the registry always has at least one key. */
const ANCHOR_ID_TUPLE = anchorIds as [AnchorId, ...AnchorId[]];

export const AnchorIdSchema = z.enum(ANCHOR_ID_TUPLE);
export const RolePathSchema = z.enum(["business", "technical", "compliance", "admin"]);
export const PhaseSchema = z.enum(["m1", "m2", "post-v1"]);
export const EngineAvailabilitySchema = z.enum(["shipped", "m2", "post-v1"]);

export const TourStepSchema = z.object({
  anchorId: AnchorIdSchema,
  titleKey: z.string(),
  bodyKey: z.string(),
});
export type TourStep = z.infer<typeof TourStepSchema>;

export const TourSchema = z.object({
  tourId: z.string(),
  area: z.string(),
  paths: z.array(RolePathSchema).nonempty(),
  phase: PhaseSchema,
  steps: z.array(TourStepSchema).min(1),
});

export const BeaconSchema = z.object({
  beaconId: z.string(),
  anchorId: AnchorIdSchema,
  paths: z.array(RolePathSchema).nonempty(),
  phase: PhaseSchema,
  bodyKey: z.string(),
});

const TourCtaSchema = z.object({ kind: z.literal("tour"), tourId: z.string() });
const ExploreFreelyCtaSchema = z.object({ kind: z.literal("explore-freely"), labelKey: z.string() });
const ReadTheGuideCtaSchema = z.object({ kind: z.literal("read-the-guide"), labelKey: z.string() });

export const WelcomeModalSchema = z.object({
  modalId: z.string(),
  area: z.string(),
  titleKey: z.string(),
  bodyKey: z.string(),
  ctas: z
    .array(z.discriminatedUnion("kind", [TourCtaSchema, ExploreFreelyCtaSchema, ReadTheGuideCtaSchema]))
    .nonempty(),
});

export const ExerciseSchema = z.object({
  exerciseId: z.string(),
  paths: z.array(RolePathSchema).nonempty(),
  phase: PhaseSchema,
  goalKey: z.string(),
  stepKeys: z.array(z.string()).min(3).max(5),
  completion: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("sparql_ask"), ask: z.string() }),
    z.object({ kind: z.literal("write_commit") }),
    z.object({ kind: z.literal("canvas_state"), state: z.string() }),
    z.object({ kind: z.literal("nav_signal"), signal: z.string() }),
  ]),
});

export const ChecklistItemSchema = z.object({
  itemId: z.string(),
  paths: z.array(RolePathSchema).nonempty(),
  phase: PhaseSchema,
  labelKey: z.string(),
  whyKey: z.string(),
  deepLink: z.string(),
  autoCompleteOn: z.enum([
    "demo_visit",
    "tour_complete",
    "exercise_complete",
    "activation_milestone",
    "manual",
  ]),
  /** TASK-010 AC-010-02: the specific tour_id/exercise_id/milestone_id
   * `autoCompleteOn` binds to -- needed because two items can share one
   * `autoCompleteOn` kind (e.g. two `exercise_complete` items), so the kind
   * alone can't say which signal row ticks which item. Unused for
   * `demo_visit` (single global signal, no instance id).
   */
  signalRefs: z.array(z.string()).optional(),
  lockedUntilPhase: PhaseSchema.optional(),
  /** TASK-010 AC-010-03: Admin-invite's "pending platform signal" badge --
   * shown only while the item is unchecked (OQ-08, no PLAT-IDENTITY-1
   * contract to poll instead).
   */
  badge: z.enum(["pending-platform-signal"]).optional(),
});

/** ONB-TASK-012 (E6-S1): the seven training categories -- `build`/`automation`
 * are flagged post-v1 (available when those engines ship), reusing
 * `EngineAvailabilitySchema` rather than a parallel enum. */
export const TrainingCategoryIdSchema = z.enum([
  "introduction",
  "ontologies",
  "graph-explorer",
  "build",
  "automation",
  "compliance-governance",
  "administration",
]);

export const TrainingEntrySchema = z.object({
  trainingId: z.string(),
  titleKey: z.string(),
  descriptionKey: z.string(),
  category: TrainingCategoryIdSchema,
  videoId: z.string().optional(),
  durationSeconds: z.number().positive().optional(),
  writtenWalkthroughUrl: z.string().optional(),
  walkthroughBodyKey: z.string().optional(),
});

export const TrainingCategorySchema = z.object({
  categoryId: TrainingCategoryIdSchema,
  labelKey: z.string(),
  availability: EngineAvailabilitySchema,
});

export const WhatsNewItemSchema = z.object({
  itemId: z.string(),
  version: z.string(),
  titleKey: z.string(),
  bodyKey: z.string(),
  publishedAt: z.string(),
});

export const WidgetSchema = z.object({
  widgetId: z.string(),
  engine: z.enum(["constitution", "graph-explorer", "build", "events", "platform"]),
  availability: EngineAvailabilitySchema,
});

export const WidgetMappingSchema = z.record(RolePathSchema, z.array(WidgetSchema).nonempty());

export type Phase = z.infer<typeof PhaseSchema>;
export type Tour = z.infer<typeof TourSchema>;
export type Beacon = z.infer<typeof BeaconSchema>;
export type WelcomeModal = z.infer<typeof WelcomeModalSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type TrainingCategoryId = z.infer<typeof TrainingCategoryIdSchema>;
export type TrainingEntry = z.infer<typeof TrainingEntrySchema>;
export type TrainingCategory = z.infer<typeof TrainingCategorySchema>;
export type WhatsNewItem = z.infer<typeof WhatsNewItemSchema>;
export type WidgetMapping = z.infer<typeof WidgetMappingSchema>;
