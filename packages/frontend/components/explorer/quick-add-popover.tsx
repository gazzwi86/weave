"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NodeKind } from "@/lib/explorer/types";

export interface QuickAddPopoverProps {
  open: boolean;
  kinds: NodeKind[];
  onSubmit: (name: string, kind: string) => void;
  onCancel: () => void;
}

const SELECT_CLASSES =
  "w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";

const CONTENT_CLASSES =
  "fixed left-1/2 top-1/2 w-full max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]";

const LABEL_CLASSES = "block text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]";

/** TASK-023 AC-3: name + kind picker opened by a double-click on empty
 * canvas -- the kind list is the CE-READ-1 palette already fetched for the
 * legend (no second fetch). Radix Dialog (already used by ConfirmDialog)
 * gives focus-trap + Escape-to-cancel for free. */
export function QuickAddPopover({ open, kinds, onSubmit, onCancel }: QuickAddPopoverProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState(kinds[0]?.id ?? "");

  const submit = () => {
    if (name.trim().length === 0) return;
    onSubmit(name, kind);
    setName("");
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content aria-label="Add node" className={CONTENT_CLASSES}>
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Add node
          </Dialog.Title>
          <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
            <label className={LABEL_CLASSES} htmlFor="quick-add-name">
              Name
              <Input id="quick-add-name" value={name} onChange={(e) => setName(e.target.value)} className="mt-[var(--space-1)]" />
            </label>
            <label className={LABEL_CLASSES} htmlFor="quick-add-kind">
              Kind
              <select id="quick-add-kind" value={kind} onChange={(e) => setKind(e.target.value)} className={`mt-[var(--space-1)] ${SELECT_CLASSES}`}>
                {kinds.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={submit}>
              Add
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
