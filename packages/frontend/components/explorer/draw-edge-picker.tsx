"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { RelKind } from "@/lib/explorer/types";

export interface DrawEdgePickerProps {
  open: boolean;
  relTypes: RelKind[];
  onSubmit: (predicate: string) => void;
  onCancel: () => void;
}

const SELECT_CLASSES =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";

const CONTENT_CLASSES =
  "fixed left-1/2 top-1/2 w-full max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]";

const LABEL_CLASSES = "block text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]";

/** TASK-023 AC-6: relationship-type picker opened when an edgehandles drag
 * releases on a valid target -- mirrors QuickAddPopover (same Radix Dialog
 * focus-trap + Escape-to-cancel pattern), the palette is the CE-READ-1
 * relTypes already fetched for the draw-edge hook (no second fetch). */
export function DrawEdgePicker({ open, relTypes, onSubmit, onCancel }: DrawEdgePickerProps) {
  const [predicate, setPredicate] = useState(relTypes[0]?.id ?? "");

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content aria-label="Choose relationship" className={CONTENT_CLASSES}>
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Connect nodes
          </Dialog.Title>
          <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
            <label className={LABEL_CLASSES} htmlFor="draw-edge-predicate">
              Relationship
              <select
                id="draw-edge-predicate"
                value={predicate}
                onChange={(e) => setPredicate(e.target.value)}
                className={`mt-[var(--space-1)] ${SELECT_CLASSES}`}
              >
                {relTypes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={() => onSubmit(predicate)}>
              Connect
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
