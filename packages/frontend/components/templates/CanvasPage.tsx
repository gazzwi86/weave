import type { ReactNode } from "react";

import { CanvasLegend, type CanvasLegendEntry } from "@/components/molecules/CanvasLegend";
import { CanvasToolbar, type CanvasToolbarTool } from "@/components/molecules/CanvasToolbar";
import { InspectorPanel, type InspectorPanelField } from "@/components/organisms/InspectorPanel";

export interface CanvasPageProps {
  tools: CanvasToolbarTool[];
  activeToolId?: string;
  onToolSelect?: (id: string) => void;
  legend: CanvasLegendEntry[];
  inspectorTitle: string;
  inspectorFields: InspectorPanelField[];
  canvas: ReactNode;
}

/** Graph/canvas page shell (`components.md` "Canvas"): toolbar top, legend
 * bottom-left overlay, inspector panel right. Data-only props -- no fetch,
 * routing, or canvas-rendering logic lives here, the caller supplies the
 * rendered canvas via `children`-equivalent `canvas` prop. */
export function CanvasPage({
  tools,
  activeToolId,
  onToolSelect,
  legend,
  inspectorTitle,
  inspectorFields,
  canvas,
}: CanvasPageProps) {
  return (
    <div className="relative flex h-full w-full">
      <div className="relative flex-1">
        <CanvasToolbar tools={tools} activeToolId={activeToolId} onSelect={onToolSelect} />
        <div className="absolute inset-0">{canvas}</div>
        <div className="absolute bottom-[var(--space-4)] left-[var(--space-4)]">
          <CanvasLegend entries={legend} />
        </div>
      </div>
      <InspectorPanel title={inspectorTitle} fields={inspectorFields} />
    </div>
  );
}
