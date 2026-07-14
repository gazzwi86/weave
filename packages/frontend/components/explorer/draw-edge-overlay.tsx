"use client";

import type { ExplorerConfig } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { RelKind } from "@/lib/explorer/types";

import { Toast } from "../ui/toast";
import { DrawEdgePicker } from "./draw-edge-picker";
import { useDrawEdge } from "./use-draw-edge";

export interface DrawEdgeOverlayProps {
  adapter: RendererAdapter;
  config: ExplorerConfig;
  canEdit: boolean;
  relTypes: RelKind[];
}

/** TASK-023 AC-6: wires useDrawEdge's relationship-type picker + violation/
 * retry feedback into the canvas -- same split-out shape as
 * QuickAddOverlay, so ExplorerInteractions stays under Law E's line
 * budget. */
export function DrawEdgeOverlay({ adapter, config, canEdit, relTypes }: DrawEdgeOverlayProps) {
  const drawEdge = useDrawEdge({ adapter, config, canEdit, relTypes });

  return (
    <>
      <DrawEdgePicker open={drawEdge.picker !== null} relTypes={relTypes} onSubmit={drawEdge.submit} onCancel={drawEdge.cancel} />
      {drawEdge.violationMessages.length > 0 && (
        <Toast message={drawEdge.violationMessages.join(" ")} onDismiss={drawEdge.dismissViolations} />
      )}
      {drawEdge.retry && (
        <Toast message="Edit failed" onDismiss={drawEdge.dismissRetry} action={{ label: "Retry", onClick: drawEdge.retry }} />
      )}
    </>
  );
}
