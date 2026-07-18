"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { DecisionDetailDrawer } from "./decision-detail-drawer";
import { actorLabel, KIND_CHIP } from "./decision-log-format";
import { type DecisionEntry, type KindFilter, useDecisionLog } from "./use-decision-log";

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "decision", label: "Decisions" },
  { value: "task_update", label: "Task updates" },
  { value: "system", label: "System" },
];

function FilterChips({ kind, onChange }: { kind: KindFilter; onChange: (k: KindFilter) => void }) {
  return (
    <div className="flex flex-wrap gap-[var(--space-2)]" role="group" aria-label="Filter by kind">
      {KIND_FILTERS.map((f) => (
        <Button
          key={f.value}
          type="button"
          variant={kind === f.value ? "primary" : "secondary"}
          aria-pressed={kind === f.value}
          onClick={() => onChange(f.value)}
        >
          {f.label}
        </Button>
      ))}
    </div>
  );
}

function SearchForm({ onApply }: { onApply: (value: string) => void }) {
  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("search");
    onApply(typeof value === "string" ? value.trim() : "");
  };
  return (
    <form onSubmit={onSubmit} className="flex items-center gap-[var(--space-2)]">
      <Input name="search" aria-label="Search decision log" placeholder="search decisions" />
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}

const CELL = "border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)]";

function DecisionRow({
  entry,
  highlighted,
  onOpen,
}: {
  entry: DecisionEntry;
  highlighted: boolean;
  onOpen: (entry: DecisionEntry) => void;
}) {
  const rowRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView({ block: "center" });
  }, [highlighted]);
  const chip = KIND_CHIP[entry.kind];
  return (
    <tr
      ref={rowRef}
      data-testid={`decision-row-${entry.seq}`}
      onClick={() => onOpen(entry)}
      className={
        "cursor-pointer " +
        (highlighted ? "bg-[var(--color-accent-primary)]/10" : "text-[var(--color-text-default)]")
      }
    >
      <td className={CELL}>{entry.ts}</td>
      <td className={CELL}>
        {actorLabel(entry.actor_principal_iri)}{" "}
        <span className="text-[var(--color-text-muted)]">{entry.actor_principal_iri}</span>
      </td>
      <td className={CELL}>
        <Badge variant={chip.variant}>{chip.label}</Badge>
      </td>
      <td className={CELL}>{entry.event_type}</td>
    </tr>
  );
}

function DecisionTable({
  entries,
  highlightSeq,
  onOpen,
  hasMore,
  loadMore,
}: {
  entries: DecisionEntry[];
  highlightSeq: number | null;
  onOpen: (entry: DecisionEntry) => void;
  hasMore: boolean;
  loadMore: () => void;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              {["When", "Actor", "Kind", "Event"].map((name) => (
                <th
                  key={name}
                  className={`${CELL} font-[var(--font-weight-semibold)] text-[var(--color-text-default)]`}
                >
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <DecisionRow
                key={entry.seq}
                entry={entry}
                highlighted={entry.seq === highlightSeq}
                onOpen={onOpen}
              />
            ))}
          </tbody>
        </table>
      </div>
      {hasMore && (
        <Button variant="secondary" onClick={loadMore}>
          Load more
        </Button>
      )}
    </>
  );
}

/** TASK-020: read-only Decision Log over PLAT-AUDIT-1 (AC-1..AC-9). No
 * mutation control exists on this surface -- the backend route this panel
 * calls is GET-only (routers/decisions.py), same read-only guarantee
 * `/audit/logs` already gives admins for the full chain.
 */
export function DecisionLogPanel({ projectId }: { projectId: string }): React.JSX.Element {
  const {
    entries,
    auditUnavailable,
    kind,
    setKind,
    applySearch,
    hasMore,
    loadMore,
    highlightSeq,
  } = useDecisionLog(projectId);
  const [openEntry, setOpenEntry] = useState<DecisionEntry | null>(null);

  if (auditUnavailable) {
    return (
      <p data-testid="decisions-unavailable" className="text-[var(--color-text-muted)]">
        Audit unavailable -- decision log cannot load right now.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
        <FilterChips kind={kind} onChange={setKind} />
        <SearchForm onApply={applySearch} />
      </div>
      {entries.length === 0 ? (
        <p data-testid="decisions-empty" className="text-[var(--color-text-muted)]">
          No decisions match this search.
        </p>
      ) : (
        <DecisionTable
          entries={entries}
          highlightSeq={highlightSeq}
          onOpen={setOpenEntry}
          hasMore={hasMore}
          loadMore={loadMore}
        />
      )}
      <DecisionDetailDrawer entry={openEntry} onClose={() => setOpenEntry(null)} />
    </div>
  );
}
