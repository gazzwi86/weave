"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";

import { ModalShell } from "../organisms/ModalShell";
import { Button } from "./button";
import { Input } from "./input";

export interface AddContributorModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (principalIri: string, role: "admin" | "editor") => void;
}

/** refit-mock.html #sub-bld-settings Add-contributor modal -- composes
 * ModalShell same as `ConfirmDialog` (both live in `components/ui`, not
 * `organisms`, since `app/**` may only reach a raw organism through a
 * template -- this is the sanctioned crossing point, ui-layer already used
 * for ConfirmDialog).
 *
 * The mock's "member search" has no backing directory endpoint yet --
 * `/api/build/projects/{id}/contributors` takes a principal IRI directly,
 * there's no `GET .../members?q=` to search against (gap sibling of G14).
 * This field is therefore a plain principal-IRI input, not a live-filtered
 * picker -- labelled honestly rather than faking a dropdown with no data
 * behind it.
 */
export function AddContributorModal({ open, onClose, onAdd }: AddContributorModalProps): React.JSX.Element {
  const [principal, setPrincipal] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");

  const submit = (): void => {
    if (!principal) return;
    onAdd(principal, role);
    setPrincipal("");
    setRole("editor");
    onClose();
  };

  return (
    <ModalShell open={open} onClose={onClose}>
      <Dialog.Title className="mb-[var(--space-4)] text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Add contributor
      </Dialog.Title>
      <label className="mb-[var(--space-3)] flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          Contributor principal
        </span>
        <Input
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          placeholder="urn:weave:principal:user:..."
        />
      </label>
      <label className="mb-[var(--space-4)] flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">Role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "editor")}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)]"
        >
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <div className="flex justify-end gap-[var(--space-2)]">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" disabled={!principal} onClick={submit}>
          Add contributor
        </Button>
      </div>
    </ModalShell>
  );
}
