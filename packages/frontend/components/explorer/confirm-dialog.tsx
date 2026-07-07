"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "@/components/ui/button";

export interface ConfirmDialogProps {
  open: boolean;
  newCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONTENT_CLASSES =
  "fixed left-1/2 top-1/2 w-full max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]";

/**
 * TASK-005 AC-4: gates a large neighbour expansion behind an explicit
 * confirmation. Never gates a fetch -- expansion reuses neighbours already
 * fetched for the side panel, so cancelling here leaves the canvas (and the
 * network) untouched.
 */
export function ConfirmDialog({ open, newCount, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)]" />
        <Dialog.Content aria-label="Confirm expand" className={CONTENT_CLASSES}>
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Load {newCount} more nodes?
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            Expanding this node will add {newCount} new nodes to the canvas.
          </Dialog.Description>
          <div className="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={onConfirm}>
              Continue
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
