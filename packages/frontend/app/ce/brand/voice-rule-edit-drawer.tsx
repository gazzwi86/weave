"use client";

import { useState, type FormEvent } from "react";

import { DrawerPage as Drawer } from "@/components/templates/DrawerPage";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

import { ASSERTION_TYPES, composeAssertion, parseAssertion, type AssertionType } from "./dsl";
import { submitDeleteNode, submitUpdateNode } from "./submit-op";
import type { VoiceRuleRow } from "./types";

const P = {
  ruleId: "https://weave.io/ontology/ruleId",
  severity: "https://weave.io/ontology/severity",
  assertion: "https://weave.io/ontology/assertion",
} as const;

const GENERIC_SAVE_ERROR = "Could not save. Please try again.";

interface VoiceRuleEditDrawerProps {
  row: VoiceRuleRow;
  onClose: () => void;
  onSaved: (iri: string) => void;
  onDeleted: (iri: string) => void;
}

function useEditState(row: VoiceRuleRow) {
  const parsed = parseAssertion(row.assertion);
  const [ruleId, setRuleId] = useState(row.ruleId);
  const [severity, setSeverity] = useState(row.severity);
  const [assertionType, setAssertionType] = useState<AssertionType>(parsed.type);
  const [assertionValue, setAssertionValue] = useState(parsed.value);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  return {
    ruleId, setRuleId,
    severity, setSeverity,
    assertionType, setAssertionType,
    assertionValue, setAssertionValue,
    error, setError,
    submitting, setSubmitting,
  };
}

type EditState = ReturnType<typeof useEditState>;

function VoiceRuleFields({ state }: { state: EditState }) {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="voice-rule-edit-id" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Rule ID
        </label>
        <Input id="voice-rule-edit-id" value={state.ruleId} onChange={(e) => state.setRuleId(e.target.value)} />
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="voice-rule-edit-severity" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Severity
        </label>
        <select
          id="voice-rule-edit-severity"
          value={state.severity}
          onChange={(e) => state.setSeverity(e.target.value as "critical" | "normal")}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)]"
        >
          <option value="critical">Critical</option>
          <option value="normal">Normal</option>
        </select>
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="voice-rule-edit-assertion-type" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Assertion type
        </label>
        <select
          id="voice-rule-edit-assertion-type"
          value={state.assertionType}
          onChange={(e) => state.setAssertionType(e.target.value as AssertionType)}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)]"
        >
          {ASSERTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="voice-rule-edit-assertion-value" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Assertion value
        </label>
        <Input
          id="voice-rule-edit-assertion-value"
          value={state.assertionValue}
          onChange={(e) => state.setAssertionValue(e.target.value)}
        />
      </div>
      {state.error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{state.error}</p>}
    </div>
  );
}

/** Brand rules tab's edit affordance (remediation-2 lane): same pattern as
 * `StandardEditDrawer` -- prefilled `voice-rule-form.tsx` fields, the
 * assertion decomposed via `dsl.ts`'s `parseAssertion` and recomposed on
 * save, dispatched as `update_node`.
 */
export function VoiceRuleEditDrawer({ row, onClose, onSaved, onDeleted }: VoiceRuleEditDrawerProps) {
  const state = useEditState(row);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSave(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    state.setSubmitting(true);
    state.setError(null);
    try {
      const properties = {
        [P.ruleId]: state.ruleId,
        [P.severity]: state.severity,
        [P.assertion]: composeAssertion(state.assertionType, state.assertionValue),
      };
      const outcome = await submitUpdateNode(row.iri, properties, P.assertion);
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
        title={row.ruleId}
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
        <VoiceRuleFields state={state} />
      </Drawer>
      <ConfirmDialog
        open={confirmingDelete}
        entityType="brand rule"
        entityName={row.ruleId}
        consequence="This can't be undone."
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
