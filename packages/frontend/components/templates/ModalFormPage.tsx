"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { FormEvent, ReactNode } from "react";

import { ModalShell, type ModalShellSize } from "@/components/organisms/ModalShell";

export interface ModalFormPageProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  fields: ReactNode;
  actions: ReactNode;
  size?: ModalShellSize;
}

/** Modal form shell (mirrors `FormDrawerPage`'s split, modal chrome instead
 * of a drawer): title + form fields + action row inside `ModalShell`. Data-
 * only props -- form state/validation/submit lives in the app layer (e.g.
 * Settings -> Members' invite modal). */
export function ModalFormPage({ open, onClose, title, onSubmit, fields, actions, size }: ModalFormPageProps) {
  return (
    <ModalShell open={open} onClose={onClose} size={size}>
      <Dialog.Title className="text-[length:var(--text-heading-sm)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {title}
      </Dialog.Title>
      <form onSubmit={onSubmit} className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
        {fields}
        <div className="mt-[var(--space-2)] flex justify-end gap-[var(--space-2)]">{actions}</div>
      </form>
    </ModalShell>
  );
}
