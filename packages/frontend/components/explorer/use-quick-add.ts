"use client";

import { useCallback, useEffect, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { commitOp, postToWriteProxy, type WriteProxyFn } from "@/lib/explorer/edit-controller";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { NodeKind } from "@/lib/explorer/types";

export interface QuickAddPopoverState {
  position: { x: number; y: number };
}

export interface UseQuickAddOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  /** AC-7 UX layer -- canEditCanvas(...), computed by the caller. */
  canEdit: boolean;
  /** AC-3: the BPMO kind palette already fetched at boot for the legend
   * (useCanvasLegend) -- reused here, not fetched a second time. */
  kinds: NodeKind[];
  /** Test seam -- defaults to the real write proxy. */
  writeProxy?: WriteProxyFn;
}

export interface UseQuickAddResult {
  popover: QuickAddPopoverState | null;
  kinds: NodeKind[];
  cancel: () => void;
  submit: (name: string, kind: string) => Promise<void>;
  violationMessages: string[];
  dismissViolations: () => void;
  retry: (() => void) | null;
  dismissRetry: () => void;
}

/** Rendered (screen) position -> model position, using the same
 * zoom/pan the renderer-adapter's own viewport already reports -- so the
 * ghost node lands under the cursor rather than at a fixed canvas origin. */
function toModelPosition(adapter: RendererAdapter, rendered: { x: number; y: number }): { x: number; y: number } {
  const { zoom, pan } = adapter.getViewport();
  return { x: (rendered.x - pan.x) / zoom, y: (rendered.y - pan.y) / zoom };
}

/** TASK-023 AC-3: double-click on empty canvas opens a name+kind popover;
 * submitting builds an `add_node` op and hands it to the shared Edit
 * Controller (commitOp) -- the same optimistic-add/commit/reconcile-or-
 * rollback lifecycle draw-edge reuses, not a second write path. */
export function useQuickAdd({
  adapter,
  config,
  canEdit,
  kinds,
  writeProxy = postToWriteProxy,
}: UseQuickAddOptions): UseQuickAddResult {
  const [popover, setPopover] = useState<QuickAddPopoverState | null>(null);
  const [violationMessages, setViolationMessages] = useState<string[]>([]);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!adapter) return undefined;
    return adapter.onBackgroundDoubleClick((position) => {
      if (!canEdit) return;
      setPopover({ position });
    });
  }, [adapter, canEdit]);

  const cancel = useCallback(() => setPopover(null), []);
  const dismissViolations = useCallback(() => setViolationMessages([]), []);
  const dismissRetry = useCallback(() => setRetry(null), []);

  const submit = useCallback(
    async (name: string, kind: string) => {
      if (!adapter || !popover) return;
      const ref = `local-${crypto.randomUUID()}`;
      const position = toModelPosition(adapter, popover.position);
      setPopover(null);
      setViolationMessages([]);
      setRetry(null);

      await commitOp({
        op: { op: "add_node", ref, kind, label: name, properties: {} },
        optimisticElement: { data: { id: ref, label: name, bpmo_kind: kind }, position },
        adapter,
        writeProxy,
        timeoutMs: config.ceTimeoutMs,
        onShaclViolations: setViolationMessages,
        onRetryable: (retryFn) => setRetry(() => retryFn),
      });
    },
    [adapter, popover, writeProxy, config.ceTimeoutMs]
  );

  return { popover, kinds, cancel, submit, violationMessages, dismissViolations, retry, dismissRetry };
}
