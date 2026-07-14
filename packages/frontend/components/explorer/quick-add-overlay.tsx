"use client";

import type { ExplorerConfig } from "@/lib/explorer/config";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { NodeKind } from "@/lib/explorer/types";

import { Toast } from "../ui/toast";
import { QuickAddPopover } from "./quick-add-popover";
import { useQuickAdd } from "./use-quick-add";

export interface QuickAddOverlayProps {
  adapter: RendererAdapter;
  config: ExplorerConfig;
  canEdit: boolean;
  kinds: NodeKind[];
}

/** TASK-023 AC-3/AC-4/AC-5: wires useQuickAdd's popover + violation/retry
 * feedback into the canvas -- split out so ExplorerInteractions stays
 * under Law E's line budget, matching the use-node-context-menu.ts /
 * node-context-menu.tsx extraction already used in this file. */
export function QuickAddOverlay({ adapter, config, canEdit, kinds }: QuickAddOverlayProps) {
  const quickAdd = useQuickAdd({ adapter, config, canEdit, kinds });

  return (
    <>
      <QuickAddPopover open={quickAdd.popover !== null} kinds={kinds} onSubmit={quickAdd.submit} onCancel={quickAdd.cancel} />
      {quickAdd.violationMessages.length > 0 && (
        <Toast message={quickAdd.violationMessages.join(" ")} onDismiss={quickAdd.dismissViolations} />
      )}
      {quickAdd.retry && (
        <Toast message="Edit failed" onDismiss={quickAdd.dismissRetry} action={{ label: "Retry", onClick: quickAdd.retry }} />
      )}
    </>
  );
}
