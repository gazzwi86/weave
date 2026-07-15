"use client";

import { useState } from "react";

import { t } from "../../lib/onboarding/i18n";
import { cardState, videoUrl } from "../../lib/onboarding/training-content";
import type { TrainingEntry } from "../../../shared/onboarding/content/schema";

export interface TrainingCardProps {
  entry: TrainingEntry;
}

/** AC-012-01/03: placeholder thumbnail + title + duration + description;
 * native `<video>` when a `videoId` exists; error state falls back to the
 * same placeholder card, never a broken player (ADR-006, E6-S1). */
export function TrainingCard({ entry }: TrainingCardProps) {
  const [errored, setErrored] = useState(false);
  const state = cardState(entry);
  const showVideo = state === "playable" && !errored;

  return (
    <article
      data-testid="training-card"
      className="flex flex-col gap-[var(--space-2)] rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
    >
      {showVideo ? (
        <video
          data-testid="training-video"
          className="w-full rounded-[var(--radius-sm)]"
          controls
          onError={() => setErrored(true)}
        >
          <source src={videoUrl(entry.videoId as string)} type="video/mp4" />
        </video>
      ) : (
        <div className="flex h-[120px] items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-raised)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          {errored ? t("onboarding.training.video-error") : t("onboarding.training.video-coming-soon")}
        </div>
      )}
      <h3 className="text-[length:var(--text-body)] text-[var(--color-text-default)]">{t(entry.titleKey)}</h3>
      {entry.durationSeconds ? (
        <span className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          {Math.round(entry.durationSeconds / 60)} min
        </span>
      ) : null}
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{t(entry.descriptionKey)}</p>
      {entry.writtenWalkthroughUrl && entry.walkthroughBodyKey ? (
        <details className="text-[length:var(--text-body-sm)]">
          <summary
            data-testid="walkthrough-link"
            className="cursor-pointer text-[var(--color-accent-primary)] hover:underline focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
          >
            {t(entry.writtenWalkthroughUrl)}
          </summary>
          <p data-testid="walkthrough-body" className="mt-[var(--space-2)] text-[var(--color-text-muted)]">
            {t(entry.walkthroughBodyKey)}
          </p>
        </details>
      ) : null}
    </article>
  );
}
