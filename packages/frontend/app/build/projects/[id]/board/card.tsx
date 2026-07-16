import Link from "next/link";

import { Card as UiCard } from "@/components/ui/card";

import { RetryChip } from "./retry-chip";
import type { BoardCard as BoardCardData } from "./types";

/** AC-1/AC-2: one board card -- task id, status label, retry chip when the
 * task has ever failed. v5 discoverability: the card links to the existing
 * five-tab task-detail page (Brief/Handoff/Tests/Console/Audit), which was
 * otherwise only reachable by hand-editing the URL. */
export function Card({ card, projectId }: { card: BoardCardData; projectId: string }): React.JSX.Element {
  return (
    <Link
      href={`/build/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(card.id)}`}
      className="block rounded-[var(--radius-base)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
    >
      <UiCard data-testid="board-card" className="flex flex-col gap-[var(--space-1)] hover:bg-[var(--color-hover)]">
        <p className="font-[var(--font-mono)] text-[length:var(--text-body-sm)]">{card.id}</p>
        <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          {card.status}
        </p>
        <RetryChip card={card} />
      </UiCard>
    </Link>
  );
}
