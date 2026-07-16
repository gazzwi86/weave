import type { FilterVisibilityResult } from "@/lib/explorer/compute-filter-visibility";

import { CanvasLegend } from "./canvas-legend";
import { CanvasToolbar } from "./canvas-toolbar";
import { EmptyState } from "./empty-state";
import { FilterPanel } from "./filter-panel";
import { OverlayPanel } from "./overlay-panel";
import { SavedViewsPanel } from "./saved-views-panel";
import { useCanvasLegend } from "./use-canvas-legend";
import type { UseCompletenessOverlayResult } from "./use-completeness-overlay";
import { useFilterPanel } from "./use-filter-panel";
import { useOverlayControls } from "./use-overlay-controls";
import type { useSavedViewsWiring } from "./use-saved-views-wiring";
import { useVersionsPanel } from "./use-versions-panel";
import { VersionsPanel } from "./versions-panel";

function SearchTriggerButton({ onOpenSearch }: { onOpenSearch: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpenSearch}
      aria-label="Search nodes"
      data-testid="explorer-search-button"
      data-tour-id="ge.canvas.spotlight-control"
      className="rounded-[var(--radius-sm)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
    >
      Search…
    </button>
  );
}

function FilterEmptyState({
  visibility,
  onClearTypes,
  onClearPropertyFilters,
}: {
  visibility: FilterVisibilityResult | null;
  onClearTypes: () => void;
  onClearPropertyFilters: () => void;
}) {
  if (visibility?.isEmpty) {
    return <EmptyState message="All entity types are hidden -- turn one back on to see the graph." onRetry={onClearTypes} />;
  }
  if (visibility?.filterMatchEmpty) {
    return <EmptyState message="No loaded nodes match the current property filters." onRetry={onClearPropertyFilters} />;
  }
  return null;
}

// TASK-020/022: the shared corner-docked chrome (D-1..D-6) -- search
// trigger in the toolbar (D-3), legend + filters + overlays + versions
// panels mounted alongside it. Extracted so ExplorerInteractions itself
// stays under Law E's line budget.
export function CanvasFilterChrome({
  onOpenSearch,
  filterPanel,
  legend,
  overlayControls,
  versionsPanel,
  savedViewsPanel,
  completenessOverlay,}: {
  onOpenSearch: () => void;
  filterPanel: ReturnType<typeof useFilterPanel>;
  legend: ReturnType<typeof useCanvasLegend>;
  overlayControls: ReturnType<typeof useOverlayControls>;
  versionsPanel: ReturnType<typeof useVersionsPanel>;
  savedViewsPanel: ReturnType<typeof useSavedViewsWiring>;
  /** TASK-027: no exclusiveGroup, so it isn't part of
   * overlayControls.toggles -- appended as its own OverlayPanel row. */
  completenessOverlay: UseCompletenessOverlayResult;}) {
  const toggles = [
    ...overlayControls.toggles,
    { id: "completeness", label: "Coverage gaps", active: completenessOverlay.active, disabled: false },
  ];
  const onToggleOverlay = (id: string) => (id === "completeness" ? completenessOverlay.toggle() : overlayControls.toggleOverlay(id));
  return (
    <>
      <FilterEmptyState
        visibility={filterPanel.visibility}
        onClearTypes={filterPanel.clearEntityTypesOff}
        onClearPropertyFilters={() => filterPanel.setPropertyFilters([])}
      />
      <CanvasToolbar>
        <SearchTriggerButton onOpenSearch={onOpenSearch} />
      </CanvasToolbar>
      <CanvasLegend palette={legend.palette} loading={legend.loading} overlay={overlayControls.legend} />
      <FilterPanel
        entityTypes={filterPanel.entityTypes}
        relTypes={filterPanel.relTypes}
        filterState={filterPanel.filterState}
        layerStatus={filterPanel.layerStatus}
        onToggleEntityType={filterPanel.toggleEntityType}
        onToggleRelType={filterPanel.toggleRelType}
        onSetPropertyFilters={filterPanel.setPropertyFilters}
        onToggleLayer={filterPanel.toggleLayer}
      />
      <div className="absolute bottom-[var(--space-4)] right-[var(--space-4)] z-[var(--z-panel)] flex w-80 max-h-[calc(100%-var(--space-8))] flex-col gap-[var(--space-3)] overflow-y-auto rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-panel)]">
        <OverlayPanel toggles={toggles} onToggleOverlay={onToggleOverlay} />
        <VersionsPanel {...versionsPanel} />
        <SavedViewsPanel {...savedViewsPanel} />
      </div>
    </>
  );
}
