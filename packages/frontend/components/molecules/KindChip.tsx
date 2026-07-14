import { cn } from "@/lib/utils";

/** The 14 BPMO kinds this chip renders (`color.md` kind-colour table). */
export type BpmoKind =
  | "activity"
  | "actor"
  | "businesscapability"
  | "businessdomain"
  | "class"
  | "concept"
  | "dataasset"
  | "event"
  | "field"
  | "goal"
  | "policy"
  | "process"
  | "service"
  | "system";

export interface KindChipProps {
  kind: BpmoKind;
  label: string;
  className?: string;
}

/**
 * Distinguishable glyph per kind (`<path>` fill inherits `currentColor`) so
 * colour is never the only carrier of meaning (`color.md` "Why colour alone
 * is never enough", WCAG 1.4.1). No shipped `--shape-kind-*` token exists
 * yet (iconography.md specs it, globals.css doesn't define it) -- this glyph
 * map is the local equivalent until that lands.
 */
const KIND_GLYPH: Record<BpmoKind, string> = {
  activity: "M8 2 14 8 8 14 2 8Z", // diamond
  actor: "M8 2 14 14 2 14Z", // triangle
  businesscapability: "M8 1 15 4.5 15 11.5 8 15 1 11.5 1 4.5Z", // hexagon
  businessdomain: "M8 1 14.5 5.5 12 13 4 13 1.5 5.5Z", // pentagon
  class: "M2 2H14V14H2Z", // square
  concept: "M8 8m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0", // circle
  dataasset: "M2 4H14V12H2Z M2 4 8 8 14 4", // envelope-ish
  event: "M8 1 10 6 15 6 11 9 12.5 14 8 11 3.5 14 5 9 1 6 6 6Z", // star
  field: "M2 8H14 M8 2V14", // cross
  goal: "M8 8m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0 M8 8m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0", // ring
  policy: "M2 3H14V6H2Z M2 7H14V10H2Z M2 11H14V14H2Z", // stack
  process: "M2 8 8 2 14 8 8 14Z M8 5 11 8 8 11 5 8Z", // nested diamond
  service: "M8 1 9.8 5.9 15 6.3 11 9.6 12.2 15 8 12 3.8 15 5 9.6 1 6.3 6.2 5.9Z", // gear-ish
  system: "M1 4H15V12H1Z M1 4 8 9 15 4", // node/mail
};

/** Chip pairing the `--color-kind-*` fill with its glyph (never colour alone). */
export function KindChip({ kind, label, className }: KindChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-sm)] px-[var(--space-2)] py-[var(--space-1)]",
        "bg-[var(--color-raised)] text-[length:var(--text-caption)] text-[var(--color-text-default)]",
        className
      )}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        width="10"
        height="10"
        className="fill-none stroke-2"
        style={{ color: `var(--color-kind-${kind})` }}
      >
        <path d={KIND_GLYPH[kind]} stroke="currentColor" fill="none" />
      </svg>
      {label}
    </span>
  );
}
