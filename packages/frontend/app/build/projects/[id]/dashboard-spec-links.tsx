"use client";

import { useState } from "react";

import { DocDrawerPage as DocDrawer } from "@/components/templates/DocDrawerPage";

import type { BoardCard, BoardResponse } from "./board/types";

type StaticDocKey = "brief" | "prd" | "roadmap" | "techspec" | "epics";
type DocKey = StaticDocKey | "tasks";

const STATIC_LINKS: { key: StaticDocKey; label: string; sub: string }[] = [
  { key: "brief", label: "Brief", sub: "approved Jul 08" },
  { key: "prd", label: "PRD", sub: "approved Jul 09" },
  { key: "roadmap", label: "Roadmap", sub: "5 weeks" },
  { key: "techspec", label: "Tech spec", sub: "incl. OpenAPI" },
  { key: "epics", label: "Epics", sub: "3 · one PR each" },
];

/** G11 gap: Brief/PRD/Roadmap/Tech spec/Epics have no API source yet (the
 * spec lives in the harness's markdown tree, not behind an endpoint) -- each
 * opens a static placeholder DocDrawer rather than fabricated content. "Task
 * briefs" is real: it lists the project's actual tasks from the already-
 * fetched board.
 */
function SpecLink({ label, sub, onOpen }: { label: string; sub: string; onOpen: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-[var(--radius-base)] px-[var(--space-2)] py-[var(--space-2)] text-left text-[length:var(--text-body-sm)] text-[var(--color-text-default)] hover:bg-[var(--color-raised)]"
    >
      <span>{label}</span>
      <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{sub}</span>
    </button>
  );
}

function StaticDocBody({ label }: { label: string }): React.JSX.Element {
  return (
    <p>
      {label} isn&apos;t available yet. This drawer will show the generated {label.toLowerCase()} for
      this project&apos;s spec once it&apos;s ready.
    </p>
  );
}

function TaskBriefsBody({ cards }: { cards: BoardCard[] }): React.JSX.Element {
  if (cards.length === 0) {
    return <p>No tasks on this project&apos;s board yet.</p>;
  }
  return (
    <ul>
      {cards.map((card) => (
        <li key={card.id}>
          <b>{card.id}</b> — {card.status}
        </li>
      ))}
    </ul>
  );
}

export function DashboardSpecLinks({ board }: { board: BoardResponse | null }): React.JSX.Element {
  const [openKey, setOpenKey] = useState<DocKey | null>(null);
  const cards = board?.cards ?? [];

  return (
    <>
      <div className="flex flex-col">
        {STATIC_LINKS.map((link) => (
          <SpecLink key={link.key} label={link.label} sub={link.sub} onOpen={() => setOpenKey(link.key)} />
        ))}
        <SpecLink label="Task briefs" sub={`${cards.length} tasks`} onOpen={() => setOpenKey("tasks")} />
      </div>
      {STATIC_LINKS.map((link) => (
        <DocDrawer
          key={link.key}
          open={openKey === link.key}
          onClose={() => setOpenKey(null)}
          title={link.label}
          meta={[link.sub]}
        >
          <StaticDocBody label={link.label} />
        </DocDrawer>
      ))}
      <DocDrawer
        open={openKey === "tasks"}
        onClose={() => setOpenKey(null)}
        title="Task briefs"
        meta={[`${cards.length} tasks`]}
      >
        <TaskBriefsBody cards={cards} />
      </DocDrawer>
    </>
  );
}
