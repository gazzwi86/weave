"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { SYSTEMS } from "./binding-card";
import type { Binding } from "./binding-slots";

const CONTENT_CLASSES =
  "fixed left-1/2 top-1/2 w-full max-w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]";

/** Shared error surface for both dialogs -- must render inside the modal
 * (not a page-level sibling): Radix marks everything outside an open
 * dialog `aria-hidden`, so a sibling alert would be invisible to a11y
 * tools while the dialog is open. */
function ErrorNote({ error }: { error: string | null }): React.JSX.Element | null {
  if (!error) return null;
  return (
    <p role="alert" className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
      {error}
    </p>
  );
}

function SaveFooter({
  disabled,
  onSave,
  onCancel,
}: {
  disabled: boolean;
  onSave: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <div className="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" variant="primary" disabled={disabled} onClick={onSave}>
        Save
      </Button>
    </div>
  );
}

function BindFields({
  connectorRef,
  spaceRef,
  onConnectorRefChange,
  onSpaceRefChange,
}: {
  connectorRef: string;
  spaceRef: string;
  onConnectorRefChange: (value: string) => void;
  onSpaceRefChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-3)]">
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          Connector instance
        </span>
        <Input
          value={connectorRef}
          onChange={(e) => onConnectorRefChange(e.target.value)}
          placeholder="e.g. jira-1"
        />
      </label>
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          Space / project key
        </span>
        <Input value={spaceRef} onChange={(e) => onSpaceRefChange(e.target.value)} placeholder="e.g. ACME" />
      </label>
    </div>
  );
}

/** Add/edit form for one system's binding -- system is fixed per slot
 * (the card it was opened from), so the form only asks for the two
 * connector-scoped refs (AC-1/AC-2/AC-4). */
export function BindDialog({
  open,
  label,
  error,
  onSave,
  onCancel,
}: {
  open: boolean;
  label: string;
  error: string | null;
  onSave: (connectorRef: string, spaceRef: string) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const [connectorRef, setConnectorRef] = useState("");
  const [spaceRef, setSpaceRef] = useState("");

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content aria-label={`Bind ${label}`} className={CONTENT_CLASSES}>
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Bind {label}
          </Dialog.Title>
          <ErrorNote error={error} />
          <BindFields
            connectorRef={connectorRef}
            spaceRef={spaceRef}
            onConnectorRefChange={setConnectorRef}
            onSpaceRefChange={setSpaceRef}
          />
          <SaveFooter
            disabled={!connectorRef || !spaceRef}
            onSave={() => onSave(connectorRef, spaceRef)}
            onCancel={onCancel}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Remove-with-confirm -- same Radix modal pattern as
 * `components/explorer/confirm-dialog.tsx`, not a bespoke inline confirm. */
export function RemoveBindingDialog({
  open,
  label,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  label: string;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content aria-label="Confirm remove" className={CONTENT_CLASSES}>
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            Remove {label} binding?
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            The project will no longer reference this external space.
          </Dialog.Description>
          <ErrorNote error={error} />
          <div className="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={onConfirm}>
              Confirm remove
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Composes both dialogs -- one is always open at most (`BindingSlots`
 * only ever sets one of `openSystem`/`removeTarget`). */
export function BindingDialogs({
  openSystem,
  bindError,
  removeTarget,
  removeError,
  onSave,
  onCancelBind,
  onConfirmRemove,
  onCancelRemove,
}: {
  openSystem: string | null;
  bindError: string | null;
  removeTarget: Binding | null;
  removeError: string | null;
  onSave: (connectorRef: string, spaceRef: string) => void;
  onCancelBind: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
}): React.JSX.Element {
  const openLabel = SYSTEMS.find((s) => s.key === openSystem)?.label ?? "";
  const removeLabel = SYSTEMS.find((s) => s.key === removeTarget?.system)?.label ?? "";
  return (
    <>
      <BindDialog
        open={openSystem !== null}
        label={openLabel}
        error={bindError}
        onSave={onSave}
        onCancel={onCancelBind}
      />
      <RemoveBindingDialog
        open={removeTarget !== null}
        label={removeLabel}
        error={removeError}
        onConfirm={onConfirmRemove}
        onCancel={onCancelRemove}
      />
    </>
  );
}
