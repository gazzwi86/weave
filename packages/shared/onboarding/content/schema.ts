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
  lockedUntilPhase: PhaseSchema.optional(),
});

export const TrainingEntrySchema = z.object({
  trainingId: z.string(),
  titleKey: z.string(),
  descriptionKey: z.string(),
  videoId: z.string().optional(),
  writtenWalkthroughUrl: z.string().optional(),
});

export const WhatsNewItemSchema = z.object({
  itemId: z.string(),
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

export type Tour = z.infer<typeof TourSchema>;
export type Beacon = z.infer<typeof BeaconSchema>;
export type WelcomeModal = z.infer<typeof WelcomeModalSchema>;
export type Exercise = z.infer<typeof ExerciseSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type TrainingEntry = z.infer<typeof TrainingEntrySchema>;
export type WhatsNewItem = z.infer<typeof WhatsNewItemSchema>;
export type WidgetMapping = z.infer<typeof WidgetMappingSchema>;
