import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Icon, type IconName } from "./icon";

export type ExplainBandTone = "accent" | "warn" | "success" | "danger";

export interface ExplainBandProps {
  tone: ExplainBandTone;
  icon: IconName;
  body: ReactNode;
  /** Trailing action slot (mock has no example, but the gate/draft cards
   * imply one is needed for a future "approve"/"publish" affordance). */
  action?: ReactNode;
  className?: string;
}

const TONE_STYLE: Record<ExplainBandTone, { band: string; chip: string }> = {
  accent: {
    band: "border-[var(--color-accent-primary)]/25 bg-[var(--color-accent-soft)]",
    chip: "bg-[var(--color-accent-soft)] text-[var(--color-accent-primary)]",
  },
  warn: {
    band: "border-[var(--color-warn)]/30 bg-[var(--color-warn)]/[.08]",
    chip: "bg-[var(--color-warn)]/15 text-[var(--color-warn)]",
  },
  success: {
    band: "border-[var(--color-success)]/25 bg-[var(--color-success)]/[.07]",
    chip: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  },
  danger: {
    band: "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/[.07]",
    chip: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  },
};

/** refit-mock.html's `.explain-band`/`.chain-explainer`/`.gate-card`/
 * `.draft-card` are one component: an inline tinted banner that only ever
 * differs by tone, icon and an optional trailing action. `body` is a
 * `ReactNode` so callers can bold their own lead-in phrase (e.g.
 * `<b className="text-[var(--color-text-default)]">How Weave works:</b> …`)
 * the way each mock variant does. */
export function ExplainBand({ tone, icon, body, action, className }: ExplainBandProps) {
  const style = TONE_STYLE[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-[var(--space-3)] rounded-[var(--radius-lg)] border p-[var(--space-4)]",
        style.band,
        className
      )}
    >
      <span
        className={cn(
          // ponytail: mock's icon chip size has no matching space token --
          // nearest step is space-6, the same call ErrorCard already made
          // for its (slightly smaller) icon chip.
          "flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)]",
          style.chip
        )}
      >
        <Icon name={icon} size={15} />
      </span>
      <div className="flex-1 text-[length:var(--text-body-sm)] leading-relaxed text-[var(--color-text-muted)]">
        {body}
      </div>
      {action}
    </div>
  );
}
