import { t } from "./i18n";
import type { TrainingCategory, TrainingEntry } from "../../../shared/onboarding/content/schema";

/** ADR-006's CloudFront URL shape: `https://<training-cdn>/onboarding/<video-id>/<rendition>.mp4`. */
export const TRAINING_CDN_HOST = "training-cdn.weave.app";

export function videoUrl(videoId: string, rendition = "720p"): string {
  return `https://${TRAINING_CDN_HOST}/onboarding/${videoId}/${rendition}.mp4`;
}

/** AC-012-03: "playable" once a `videoId` exists, "placeholder" (coming soon) otherwise. */
export function cardState(entry: TrainingEntry): "playable" | "placeholder" {
  return entry.videoId ? "playable" : "placeholder";
}

export interface CategoryGroup {
  category: TrainingCategory;
  entries: TrainingEntry[];
}

/** AC-012-01: every category renders, including empty/flagged ones. */
export function groupByCategory(entries: TrainingEntry[], categories: TrainingCategory[]): CategoryGroup[] {
  return categories.map((category) => ({
    category,
    entries: entries.filter((entry) => entry.category === category.categoryId),
  }));
}

/** AC-012-02: substring match over title + description + category, built
 * once per call -- no search index/library for this content volume. */
export function filterTraining(entries: TrainingEntry[], query: string): TrainingEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) => {
    const haystack = `${t(entry.titleKey)} ${t(entry.descriptionKey)} ${entry.category}`.toLowerCase();
    return haystack.includes(needle);
  });
}
