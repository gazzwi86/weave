"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { FilterBar, type FilterChip } from "@/components/ui/filter-bar";

import { ProjectCard } from "./project-card";
import { EMPTY_FILTERS, type GridFilters, useProjectGrid } from "./use-project-grid";

const ALL_PHASES_ID = "all";

/** refit-mock.html `.filter-bar` (`#sub-types`) treatment: search-input +
 * chip row, same idiom the Types/Instances/Glossary screens already use --
 * "Lifecycle phase" reads as a single-select chip group (one active id at a
 * time) rather than a `<select>`, since the mock never renders a bare
 * dropdown inside a filter-bar. */
const PHASE_CHIPS: FilterChip[] = [
  { id: ALL_PHASES_ID, label: "All phases" },
  { id: "Speccing", label: "Speccing" },
  { id: "Building", label: "Building" },
  { id: "Live monitoring", label: "Live monitoring" },
  { id: "Archived", label: "Archived" },
];

function RegistryFilterBar({
  filters,
  onChange,
}: {
  filters: GridFilters;
  onChange: (next: GridFilters) => void;
}): React.JSX.Element {
  return (
    <FilterBar
      chips={PHASE_CHIPS}
      activeIds={[filters.lifecyclePhase || ALL_PHASES_ID]}
      onToggle={(id) => onChange({ ...filters, lifecyclePhase: id === ALL_PHASES_ID ? "" : id })}
      search={{
        value: filters.search,
        onChange: (value) => onChange({ ...filters, search: value }),
        label: "Search projects",
        placeholder: "Search by name",
      }}
    />
  );
}

function EmptyState({ onClear }: { onClear: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-[var(--space-3)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-8)] text-center">
      <p className="text-[length:var(--text-body)] text-[var(--color-text-muted)]">
        No projects match the current filters.
      </p>
      <Button variant="secondary" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

function GridSkeleton(): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-[var(--space-5)] sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-[var(--color-raised)] motion-reduce:animate-none"
        />
      ))}
    </div>
  );
}

/** Registry grid (AC-1/AC-2): card grid with search + phase filter, empty
 * state on zero matches. Filter state is local component state, not
 * URL-synced -- the brief's URL-searchParams note is an Implementation
 * Hint, not an AC; skipped for now (ponytail: add useSearchParams sync
 * if shareable/back-button filtered views are actually requested). */
export function RegistryGrid(): React.JSX.Element {
  const [filters, setFilters] = useState<GridFilters>(EMPTY_FILTERS);
  const { page, loadError } = useProjectGrid(filters);

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <RegistryFilterBar filters={filters} onChange={setFilters} />
      {page === null && !loadError && <GridSkeleton />}
      {loadError && (
        <p role="alert" className="text-[var(--color-danger)]">
          Unable to load projects — try again shortly.
        </p>
      )}
      {page !== null && !loadError && page.items.length === 0 && (
        <EmptyState onClear={() => setFilters(EMPTY_FILTERS)} />
      )}
      {page !== null && !loadError && page.items.length > 0 && (
        <div className="grid grid-cols-1 gap-[var(--space-5)] sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((project) => (
            <ProjectCard key={project.project_iri} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
