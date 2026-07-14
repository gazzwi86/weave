"use client";

import { useCallback, useEffect, useState } from "react";

import type { ExplorerConfig } from "@/lib/explorer/config";
import { commitOp, postToWriteProxy, type WriteProxyFn } from "@/lib/explorer/edit-controller";
import type { RendererAdapter } from "@/lib/explorer/renderer-adapter";
import type { RelKind } from "@/lib/explorer/types";

export interface DrawEdgePickerState {
  sourceId: string;
  targetId: string;
}

export interface UseDrawEdgeOptions {
  adapter: RendererAdapter | null;
  config: ExplorerConfig;
  /** AC-7 UX layer -- canEditCanvas(...), computed by the caller. */
  canEdit: boolean;
  /** AC-6: the CE-READ-1 relationship-type catalogue for the picker. */
  relTypes: RelKind[];
  /** Test seam -- defaults to the real write proxy. */
  writeProxy?: WriteProxyFn;
}

export interface UseDrawEdgeResult {
  picker: DrawEdgePickerState | null;
  relTypes: RelKind[];
  cancel: () => void;
  submit: (predicate: string) => Promise<void>;
  violationMessages: string[];
  dismissViolations: () => void;
  retry: (() => void) | null;
  dismissRetry: () => void;
}

/** TASK-023 AC-6: an edgehandles drag release opens a relationship-type
 * picker; submitting builds an `add_edge` op and hands it to the shared
 * Edit Controller (commitOp) -- the same optimistic-add/commit/reconcile-
 * or-rollback lifecycle quick-add uses, not a second write path.
 * Self-loops are blocked here (in addition to the library's own
 * `canConnect` default, ADR-022) so the "no network call" guarantee holds
 * even if a future edgehandles config change relaxes the library check. */
export function useDrawEdge({
  adapter,
  config,
  canEdit,
  relTypes,
  writeProxy = postToWriteProxy,
}: UseDrawEdgeOptions): UseDrawEdgeResult {
  const [picker, setPicker] = useState<DrawEdgePickerState | null>(null);
  const [violationMessages, setViolationMessages] = useState<string[]>([]);
  const [retry, setRetry] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!adapter) return undefined;
    return adapter.onEdgeDrawComplete((sourceId, targetId) => {
      if (!canEdit || sourceId === targetId) return;
      setPicker({ sourceId, targetId });
    });
  }, [adapter, canEdit]);

  const cancel = useCallback(() => setPicker(null), []);
  const dismissViolations = useCallback(() => setViolationMessages([]), []);
  const dismissRetry = useCallback(() => setRetry(null), []);

  const submit = useCallback(
    async (predicate: string) => {
      if (!adapter || !picker) return;
      const { sourceId, targetId } = picker;
      const edgeId = `${sourceId}|${predicate}|${targetId}`;
      setPicker(null);
      setViolationMessages([]);
      setRetry(null);

      await commitOp({
        op: { op: "add_edge", subject_ref: sourceId, predicate, object_ref: targetId },
        optimisticElement: { data: { id: edgeId, source: sourceId, target: targetId, label: predicate } },
        adapter,
        writeProxy,
        timeoutMs: config.ceTimeoutMs,
        onShaclViolations: setViolationMessages,
        onRetryable: (retryFn) => setRetry(() => retryFn),
      });
    },
    [adapter, picker, writeProxy, config.ceTimeoutMs]
  );

  return { picker, relTypes, cancel, submit, violationMessages, dismissViolations, retry, dismissRetry };
}
