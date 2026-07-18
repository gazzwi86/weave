"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { ModalShell } from "../organisms/ModalShell";
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
 * confirmation, routed to from every delete affordance in the app. Composes
 * ModalShell for the glass surface/positioning/close behaviour -- only owns
 * the title/description/actions content. */
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
    <ModalShell open={open} onClose={onCancel}>
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
    </ModalShell>
  );
}
