import { useState } from "react";

import { CanvasLegend } from "@/components/molecules/CanvasLegend";
import { ControlDock, type ControlDockTab } from "@/components/molecules/ControlDock";
import { KpiStrip } from "@/components/molecules/KpiStrip";
import { OverlayKey } from "@/components/molecules/OverlayKey";
import { Icon } from "@/components/ui/icon";
import { overlayLegendToSections, paletteToLegendEntries } from "@/lib/explorer/canvas-legend-entries";
import type { FilterVisibilityResult } from "@/lib/explorer/compute-filter-visibility";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";

import { canvasKpiItems } from "./canvas-kpi-items";
import { CanvasToolbar } from "./canvas-toolbar";
import { EmptyState } from "./empty-state";
import { FilterPanel, LayerPanel } from "./filter-panel";
import { OverlayPanel } from "./overlay-panel";
import { SavedViewsPanel } from "./saved-views-panel";
import type { UseCanvasOverlayTogglesResult } from "./use-canvas-overlay-toggles";
import { useCanvasLegend } from "./use-canvas-legend";
import { useFilterPanel } from "./use-filter-panel";
import { useOverlayControls, type OverlayToggle } from "./use-overlay-controls";
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

// refit-mock.html `.legend .zoom` -- relative zoom via the ADR-001 adapter
// seam (no dedicated zoom-by helper on RendererAdapter, so this reads
// getViewport() and writes the scaled value straight back).
// ponytail: no adapter.fit()/fit-to-bounds exists yet, so the mock's third
// "fit to screen" (⤢) zoom button is skipped -- add it once the adapter
// grows that method.
function LegendZoomControls({ adapter }: { adapter: RendererAdapter | null }) {
  const zoomBy = (factor: number) => {
    if (!adapter) return;
    const { zoom, pan } = adapter.getViewport();
    adapter.setViewport({ zoom: zoom * factor, pan });
  };
  return (
    <>
      <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.25)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]">
        +
      </button>
      <button type="button" aria-label="Zoom out" onClick={() => zoomBy(0.8)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]">
        −
      </button>
    </>
  );
}

interface DockTabsOptions {
  filterPanel: ReturnType<typeof useFilterPanel>;
  versionsPanel: ReturnType<typeof useVersionsPanel>;
  savedViewsPanel: ReturnType<typeof useSavedViewsWiring>;
  toggles: OverlayToggle[];
  onToggleOverlay: (id: string) => void;
}

// TASK-020/021/022: the four ControlDock tabs -- pulled out so
// CanvasFilterChrome itself stays under Law E's line budget.
function buildDockTabs({ filterPanel, versionsPanel, savedViewsPanel, toggles, onToggleOverlay }: DockTabsOptions): ControlDockTab[] {
  return [
    {
      id: "filters",
      label: "Filters",
      icon: <Icon name="list" size={15} />,
      panel: (
        <FilterPanel
          entityTypes={filterPanel.entityTypes}
          relTypes={filterPanel.relTypes}
          filterState={filterPanel.filterState}
          onToggleEntityType={filterPanel.toggleEntityType}
          onToggleRelType={filterPanel.toggleRelType}
          onSetPropertyFilters={filterPanel.setPropertyFilters}
        />
      ),
    },
    {
      id: "layers",
      label: "Layers",
      icon: <Icon name="layers" size={15} />,
      panel: <LayerPanel layerStatus={filterPanel.layerStatus} onToggleLayer={filterPanel.toggleLayer} />,
    },
    {
      id: "overlays",
      label: "Overlays",
      icon: <Icon name="target" size={15} />,
      panel: <OverlayPanel toggles={toggles} onToggleOverlay={onToggleOverlay} />,
    },
    {
      id: "versions",
      label: "Versions",
      icon: <Icon name="git" size={15} />,
      panel: (
        <div className="space-y-[var(--space-3)]">
          <VersionsPanel {...versionsPanel} />
          <SavedViewsPanel {...savedViewsPanel} />
        </div>
      ),
    },
  ];
}

interface CanvasFilterChromeProps {
  adapter: RendererAdapter | null;
  onOpenSearch: () => void;
  filterPanel: ReturnType<typeof useFilterPanel>;
  legend: ReturnType<typeof useCanvasLegend>;
  overlayControls: ReturnType<typeof useOverlayControls>;
  versionsPanel: ReturnType<typeof useVersionsPanel>;
  savedViewsPanel: ReturnType<typeof useSavedViewsWiring>;
  /** refit deferred item 1: completeness/impact/version-diff/change-heatmap
   * -- none carry a "colour" exclusiveGroup, so they're appended as their
   * own OverlayPanel rows rather than folded into overlayControls.toggles. */
  canvasOverlayToggles: UseCanvasOverlayTogglesResult;
}

// TASK-020/022: the shared corner-docked chrome (D-1..D-6) -- search
// trigger in the toolbar (D-3), KPI strip, kind legend, and the
// filters/layers/overlays/versions ControlDock mounted alongside it.
// Extracted so ExplorerInteractions itself stays under Law E's line budget.
export function CanvasFilterChrome({
  adapter,
  onOpenSearch,
  filterPanel,
  legend,
  overlayControls,
  versionsPanel,
  savedViewsPanel,
  canvasOverlayToggles,
}: CanvasFilterChromeProps) {
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const toggles = [...overlayControls.toggles, ...canvasOverlayToggles.toggles];
  const onToggleOverlay = (id: string) =>
    overlayControls.toggles.some((toggle) => toggle.id === id)
      ? overlayControls.toggleOverlay(id)
      : canvasOverlayToggles.onToggleOverlay(id);
  const tabs = buildDockTabs({ filterPanel, versionsPanel, savedViewsPanel, toggles, onToggleOverlay });

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
      <KpiStrip items={canvasKpiItems(versionsPanel.versions)} className="absolute left-1/2 top-[var(--space-4)] z-[var(--z-panel)] -translate-x-1/2" />
      <ControlDock
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        className="absolute left-[var(--space-4)] top-[var(--space-10)] z-[var(--z-panel)] w-80 max-h-[calc(100%-var(--space-10)-var(--space-4))]"
      />
      <CanvasLegend
        entries={paletteToLegendEntries(legend.palette)}
        statusLabel={legend.loading ? "Loading…" : `${legend.palette.length} kinds`}
        zoomControls={<LegendZoomControls adapter={adapter} />}
        className="absolute bottom-[var(--space-4)] left-[var(--space-4)] z-[var(--z-panel)] w-80 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-overlay)] p-[var(--space-3)] shadow-[var(--shadow-overlay)] backdrop-blur-md"
      />
      <OverlayKey
        sections={overlayLegendToSections(overlayControls.legend)}
        className="absolute bottom-[var(--space-4)] right-[var(--space-4)] z-[var(--z-panel)] w-64"
      />
    </>
  );
}
