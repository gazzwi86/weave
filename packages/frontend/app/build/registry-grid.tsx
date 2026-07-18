"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { ProjectCard } from "./project-card";
import { EMPTY_FILTERS, type GridFilters, useProjectGrid } from "./use-project-grid";

const PHASE_OPTIONS = ["Speccing", "Building", "Live monitoring", "Archived"] as const;

function FilterBar({
  filters,
  onChange,
}: {
  filters: GridFilters;
  onChange: (next: GridFilters) => void;
}): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-[var(--space-4)]">
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          Search projects
        </span>
        <Input
          aria-label="Search projects"
          value={filters.search}
          placeholder="Search by name"
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          Lifecycle phase
        </span>
        <select
          aria-label="Lifecycle phase"
          value={filters.lifecyclePhase}
          onChange={(e) => onChange({ ...filters, lifecyclePhase: e.target.value })}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
        >
          <option value="">All phases</option>
          {PHASE_OPTIONS.map((phase) => (
            <option key={phase} value={phase}>
              {phase}
            </option>
          ))}
        </select>
      </label>
    </div>
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
      <FilterBar filters={filters} onChange={setFilters} />
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
