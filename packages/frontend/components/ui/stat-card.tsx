import { cn } from "@/lib/utils";

export type StatCardTone = "neutral" | "ok" | "bad";

export interface StatCardProps {
  value: string;
  label: string;
  tone?: StatCardTone;
  className?: string;
}

const TONE_COLOUR: Record<StatCardTone, string> = {
  neutral: "text-[var(--color-text-default)]",
  ok: "text-[var(--color-success)]",
  bad: "text-[var(--color-danger)]",
};

/** refit-mock.html `.stat-card` -- flat mono-value tile (`.sv`/`.sl`). */
export function StatCard({ value, label, tone = "neutral", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        "p-[var(--space-3)]",
        className
      )}
    >
      <div
        className={cn(
          "font-mono text-[length:var(--text-h2)] font-[var(--font-weight-semibold)]",
          TONE_COLOUR[tone]
        )}
      >
        {value}
      </div>
      <div className="mt-[var(--space-1)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        {label}
      </div>
    </div>
  );
}
