"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "./button";
import { Icon } from "./icon";

export interface ConfirmDialogProps {
  open: boolean;
  /** e.g. "workspace", "rule" -- lower-cased into the title. */
  entityType: string;
  entityName: string;
  /** The consequence body copy, e.g. "This can't be undone." */
  consequence: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}

/** refit-mock.html `.modal-wrap`/`.modal` -- the shared destructive-action
 * confirmation, routed to from every delete affordance in the app. Radix
 * Dialog gives backdrop-click + Escape close, the focus trap, and
 * `aria-modal` for free (the same primitive already used by
 * AvatarMenu/NotificationCenter/HelpLauncher) -- no hand-rolled focus-trap
 * logic here. */
export function ConfirmDialog({
  open,
  entityType,
  entityName,
  consequence,
  onCancel,
  onConfirm,
  confirmLabel = "Delete",
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content
          aria-modal="true"
          className="fixed top-1/2 left-1/2 z-[var(--z-modal)] w-full max-w-[var(--size-modal)] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-overlay)] p-[var(--space-5)] shadow-[var(--shadow-overlay)] backdrop-blur-md"
        >
          <Dialog.Title className="mb-[var(--space-2)] flex items-center gap-[var(--space-3)] text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            <span className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-base)] bg-[var(--color-danger)]/15 text-[var(--color-danger)]">
              <Icon name="trash" size={14} />
            </span>
            Delete {entityType} &quot;{entityName}&quot;?
          </Dialog.Title>
          <Dialog.Description className="mb-[var(--space-4)] text-[length:var(--text-body-sm)] leading-relaxed text-[var(--color-text-muted)]">
            {consequence}
          </Dialog.Description>
          <div className="flex justify-end gap-[var(--space-2)]">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
