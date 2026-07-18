import Link from "next/link";

import { cn } from "@/lib/utils";

import { Icon } from "./icon";

export type ChainStatus = "valid" | "broken";

export interface ChainStatusChipProps {
  status: ChainStatus;
  /** Destination the chip links to (the Compliance page, which carries the
   * full chain-verification detail behind this summary). */
  href: string;
  className?: string;
}

const STATUS_LABEL: Record<ChainStatus, string> = {
  valid: "Chain valid · details in Compliance",
  broken: "Chain broken · details in Compliance",
};

const STATUS_STYLE: Record<ChainStatus, string> = {
  valid: "text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/30",
  broken: "text-[var(--color-danger)] bg-[var(--color-danger)]/10 border-[var(--color-danger)]/30",
};

/** refit-mock.html `.chain-chip` -- icon+text summary of chain integrity,
 * clickable through to the Compliance page for the full detail. Distinct
 * from `StatusPill` (single-word pill, no icon/link): this is a compact
 * "explain band" pattern of its own. */
export function ChainStatusChip({ status, href, className }: ChainStatusChipProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-[var(--space-1)] rounded-[var(--radius-full)] border",
        "px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-caption)] font-[var(--font-weight-semibold)]",
        STATUS_STYLE[status],
        className
      )}
    >
      <Icon name="shield" size={12} />
      {STATUS_LABEL[status]}
    </Link>
  );
}
