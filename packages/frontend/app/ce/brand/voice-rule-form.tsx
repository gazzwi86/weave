"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { currentActorIri } from "./actor";
import { recordAttribution } from "./attribution";
import { ASSERTION_TYPES, composeAssertion, type AssertionType } from "./dsl";
import { submitAddNode } from "./submit-op";
import { VOICE_RULE_KIND } from "./types";

// TASK-003's VoiceRuleShape (framework.shacl.ttl) -- hardcoded, not
// fetched: see standard-form.tsx's identical ADR-022 note.
const P = {
  ruleId: "https://weave.io/ontology/ruleId",
  severity: "https://weave.io/ontology/severity",
  assertion: "https://weave.io/ontology/assertion",
} as const;

// QA TASK-004 fix: shown when submitAddNode throws (network failure /
// unparseable error body) or resolves with a failure status but no
// SHACL violations to field-anchor -- anchored on P.assertion so it
// reuses the existing AssertionField error paragraph, no new UI.
const GENERIC_SUBMIT_ERROR = "Could not save. Please try again.";

/** Falls back to a generic message when the server gave no field-anchored
 * violations to show (e.g. a failure response with an empty body).
 */
function outcomeErrors(errors: Record<string, string>, fallbackField: string): Record<string, string> {
  return Object.keys(errors).length > 0 ? errors : { [fallbackField]: GENERIC_SUBMIT_ERROR };
}

type Severity = "critical" | "normal";

function useVoiceRuleFormState(onCommitted: (iri: string) => void) {
  const [ruleId, setRuleId] = useState("");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [assertionType, setAssertionType] = useState<AssertionType>("regex");
  const [assertionValue, setAssertionValue] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [committedIri, setCommittedIri] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    const properties = {
      [P.ruleId]: ruleId,
      [P.severity]: severity,
      [P.assertion]: composeAssertion(assertionType, assertionValue),
    };
    try {
      const outcome = await submitAddNode(
        { op: "add_node", ref: "form1", kind: VOICE_RULE_KIND, label: ruleId, properties },
        P.assertion
      );
      if (!outcome.iri || !outcome.versionIri) return setErrors(outcomeErrors(outcome.errors, P.assertion));
      const actorIri = await currentActorIri();
      recordAttribution(outcome.iri, { actorIri, versionIri: outcome.versionIri, committedAt: new Date().toISOString() });
      setCommittedIri(outcome.iri);
      onCommitted(outcome.iri);
    } catch {
      setErrors({ [P.assertion]: GENERIC_SUBMIT_ERROR });
    } finally {
      setSubmitting(false);
    }
  }

  return {
    ruleId,
    setRuleId,
    severity,
    setSeverity,
    assertionType,
    setAssertionType,
    assertionValue,
    setAssertionValue,
    errors,
    submitting,
    committedIri,
    handleSubmit,
  };
}

function SeverityField({
  value,
  error,
  onChange,
}: {
  value: Severity | "";
  error?: string;
  onChange: (value: Severity) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label htmlFor="voice-rule-severity" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        Severity
      </label>
      <select
        id="voice-rule-severity"
        required
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value as Severity)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)]"
      >
        <option value="">Select…</option>
        <option value="critical">Critical</option>
        <option value="normal">Normal</option>
      </select>
      {error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

function AssertionField({
  type,
  value,
  error,
  onTypeChange,
  onValueChange,
}: {
  type: AssertionType;
  value: string;
  error?: string;
  onTypeChange: (type: AssertionType) => void;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label htmlFor="voice-rule-assertion-type" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        Assertion type
      </label>
      <select
        id="voice-rule-assertion-type"
        value={type}
        onChange={(event) => onTypeChange(event.target.value as AssertionType)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)]"
      >
        {ASSERTION_TYPES.map((assertionType) => (
          <option key={assertionType} value={assertionType}>
            {assertionType}
          </option>
        ))}
      </select>
      <label htmlFor="voice-rule-assertion-value" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        Assertion value
      </label>
      <Input
        id="voice-rule-assertion-value"
        required
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

/** AC-004-02: creates a VoiceRule via CE-WRITE-1 -- severity + assertion
 * (composed from a type-select + value, dsl.ts) required; a missing
 * assertion 422 field-anchors onto the assertion value field.
 */
export function VoiceRuleForm({ onCommitted }: { onCommitted: (iri: string) => void }) {
  const state = useVoiceRuleFormState(onCommitted);
  const { handleSubmit } = state;

  if (state.committedIri) {
    return (
      <p className="text-[length:var(--text-body)] text-[var(--color-text-default)]">
        Created {state.committedIri}.
      </p>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-[var(--space-3)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <label htmlFor="voice-rule-id" className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
          Rule ID
        </label>
        <Input
          id="voice-rule-id"
          required
          value={state.ruleId}
          aria-invalid={Boolean(state.errors[P.ruleId])}
          onChange={(event) => state.setRuleId(event.target.value)}
        />
        {state.errors[P.ruleId] && (
          <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{state.errors[P.ruleId]}</p>
        )}
      </div>
      <SeverityField value={state.severity} error={state.errors[P.severity]} onChange={state.setSeverity} />
      <AssertionField
        type={state.assertionType}
        value={state.assertionValue}
        error={state.errors[P.assertion]}
        onTypeChange={state.setAssertionType}
        onValueChange={state.setAssertionValue}
      />
      <Button type="submit" disabled={state.submitting}>
        Save
      </Button>
    </form>
  );
}
