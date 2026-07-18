import { cn } from "@/lib/utils";

export interface RelativeTimeProps {
  /** ISO-8601 timestamp -- the only accepted input shape (AC-9: raw ISO is
   * never primary text, but stays available as the native hover tooltip). */
  iso: string;
  className?: string;
}

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.34524, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** Friendly "3 hours ago" from an ISO timestamp, walking Intl's standard
 * second→year cascade (Intl.RelativeTimeFormat docs' own division table). */
function toRelative(iso: string): string {
  let duration = (new Date(iso).getTime() - Date.now()) / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatter.format(Math.round(duration), "years");
}

/**
 * `--text-caption` relative-time display (F-D08): a raw ISO-8601 string is
 * never primary text anywhere in the shell -- the full timestamp is only
 * ever the native hover tooltip (`title`) / `<time>` `dateTime` attribute.
 */
export function RelativeTime({ iso, className }: RelativeTimeProps) {
  // ponytail: computed once per render off Date.now(), not a live-ticking
  // clock -- the panels this renders in (BellPanel) are only ever as fresh
  // as their last fetch anyway (use-notifications.ts fetches on mount/open,
  // no polling). Same pattern as app/ce/versions/version-row.tsx's
  // relativeTime(): a plain helper call in the render body, not a hook.
  return (
    <time
      dateTime={iso}
      title={iso}
      // The relative string is derived from Date.now(), so the SSR render (server
      // clock) and the hydration render (browser clock, moments later) legitimately
      // differ for recent timestamps -- React's sanctioned escape hatch for exactly
      // this "the text is a timestamp" case. Without it, any "N seconds/minutes ago"
      // item throws a hydration-mismatch error (seen on /dashboard's activity feed).
      suppressHydrationWarning
      className={cn("text-[length:var(--text-caption)] text-[var(--color-text-muted)]", className)}
    >
      {toRelative(iso)}
    </time>
  );
}
