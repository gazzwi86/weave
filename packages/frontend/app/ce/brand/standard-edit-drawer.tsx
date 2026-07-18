"use client";

import { useState, type FormEvent } from "react";

import { DrawerPage as Drawer } from "@/components/templates/DrawerPage";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

import { submitDeleteNode, submitUpdateNode } from "./submit-op";
import type { BrandStandardRow } from "./types";

const P = {
  contentType: "https://weave.io/ontology/contentType",
  contentBody: "https://weave.io/ontology/contentBody",
  sourceUri: "https://weave.io/ontology/sourceUri",
  effectiveDate: "https://weave.io/ontology/effectiveDate",
  owner: "https://weave.io/ontology/owner",
} as const;

const GENERIC_SAVE_ERROR = "Could not save. Please try again.";

interface StandardEditDrawerProps {
  row: BrandStandardRow;
  onClose: () => void;
  onSaved: (iri: string) => void;
  onDeleted: (iri: string) => void;
}

function useEditState(row: BrandStandardRow) {
  const [contentType, setContentType] = useState(row.contentType);
  const [body, setBody] = useState(row.contentBody ?? "");
  const [sourceUri, setSourceUri] = useState(row.sourceUri ?? "");
  const [effectiveDate, setEffectiveDate] = useState(row.effectiveDate);
  const [owner, setOwner] = useState(row.owner);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  return {
    contentType, setContentType,
    body, setBody,
    sourceUri, setSourceUri,
    effectiveDate, setEffectiveDate,
    owner, setOwner,
    error, setError,
    submitting, setSubmitting,
  };
}

type EditState = ReturnType<typeof useEditState>;

function StandardFields({ state }: { state: EditState }) {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="standard-edit-content-type" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Content type
        </label>
        <Input id="standard-edit-content-type" value={state.contentType} onChange={(e) => state.setContentType(e.target.value)} />
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="standard-edit-content-body" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Content body
        </label>
        <Input id="standard-edit-content-body" value={state.body} onChange={(e) => state.setBody(e.target.value)} />
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="standard-edit-source-url" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Source URL
        </label>
        <Input id="standard-edit-source-url" value={state.sourceUri} onChange={(e) => state.setSourceUri(e.target.value)} />
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="standard-edit-effective-date" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Effective date
        </label>
        <Input
          id="standard-edit-effective-date"
          type="date"
          value={state.effectiveDate}
          onChange={(e) => state.setEffectiveDate(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="standard-edit-owner" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Owner
        </label>
        <Input id="standard-edit-owner" value={state.owner} onChange={(e) => state.setOwner(e.target.value)} />
      </div>
      {state.error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{state.error}</p>}
    </div>
  );
}

/** Standards tab's edit affordance (remediation-2 lane): the create form's
 * fields (`standard-form.tsx`), prefilled from the row and dispatched as
 * `update_node` via `submitUpdateNode` instead of `add_node`. Delete lives
 * in the Drawer's `dangerSlot`, gated behind `ConfirmDialog` -- same
 * convention as every other delete affordance in the app.
 */
export function StandardEditDrawer({ row, onClose, onSaved, onDeleted }: StandardEditDrawerProps) {
  const state = useEditState(row);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSave(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    state.setSubmitting(true);
    state.setError(null);
    try {
      const properties: Record<string, string> = {
        [P.contentType]: state.contentType,
        [P.contentBody]: state.body,
        [P.sourceUri]: state.sourceUri,
        [P.effectiveDate]: state.effectiveDate,
        [P.owner]: state.owner,
      };
      const outcome = await submitUpdateNode(row.iri, properties, P.contentType);
      if (!outcome.iri) return state.setError(Object.values(outcome.errors)[0] ?? GENERIC_SAVE_ERROR);
      onSaved(outcome.iri);
    } catch {
      state.setError(GENERIC_SAVE_ERROR);
    } finally {
      state.setSubmitting(false);
    }
  }

  async function handleDelete(): Promise<void> {
    setConfirmingDelete(false);
    const outcome = await submitDeleteNode(row.iri);
    if (outcome.ok) onDeleted(row.iri);
    else state.setError(outcome.errorMessage);
  }

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        icon="mic"
        tone="var(--color-accent-primary)"
        title={row.contentType}
        dangerSlot={
          <Button variant="ghost" className="text-[var(--color-danger)]" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        }
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={state.submitting}>
              Save
            </Button>
          </>
        }
      >
        <StandardFields state={state} />
      </Drawer>
      <ConfirmDialog
        open={confirmingDelete}
        entityType="standard"
        entityName={row.contentType}
        consequence="This can't be undone."
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
