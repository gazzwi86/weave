"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { currentActorIri } from "./actor";
import { recordAttribution } from "./attribution";
import { submitAddNode } from "./submit-op";
import { BRAND_STANDARD_KIND } from "./types";

// TASK-003's BrandStandardShape (framework.shacl.ttl) -- hardcoded, not
// fetched: ADR-022 deliberately excludes BrandStandard from the BPMO
// catalogue useKindShape reads, so there is no shape to fetch here. Keys
// are the shape's full predicate IRIs so a 422's `violation.path` lands on
// the right field (see submit-op.ts).
const P = {
  contentType: "https://weave.io/ontology/contentType",
  contentBody: "https://weave.io/ontology/contentBody",
  sourceUri: "https://weave.io/ontology/sourceUri",
  effectiveDate: "https://weave.io/ontology/effectiveDate",
  owner: "https://weave.io/ontology/owner",
} as const;

type SourceMode = "body" | "source";

interface CommitResult {
  iri: string;
  versionIri: string;
  actorIri: string;
}

function useStandardFormState(onCommitted: (iri: string) => void) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<SourceMode>("body");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);

  function setField(key: string, value: string): void {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    const properties: Record<string, string> = {
      [P.contentType]: values[P.contentType] ?? "",
      [P.effectiveDate]: values[P.effectiveDate] ?? "",
      [P.owner]: values[P.owner] ?? "",
      [mode === "body" ? P.contentBody : P.sourceUri]: values[mode === "body" ? P.contentBody : P.sourceUri] ?? "",
    };
    const outcome = await submitAddNode(
      { op: "add_node", ref: "form1", kind: BRAND_STANDARD_KIND, label: values[P.contentType] ?? "", properties },
      P.contentType
    );
    setSubmitting(false);
    if (!outcome.iri || !outcome.versionIri) {
      setErrors(outcome.errors);
      return;
    }
    const actorIri = await currentActorIri();
    const committedAt = new Date().toISOString(); // ponytail: client-time approximation, see attribution.ts
    recordAttribution(outcome.iri, { actorIri, versionIri: outcome.versionIri, committedAt });
    setResult({ iri: outcome.iri, versionIri: outcome.versionIri, actorIri });
    onCommitted(outcome.iri);
  }

  return { values, mode, setMode, errors, submitting, result, setField, handleSubmit };
}

function TextField({
  id,
  label,
  type = "text",
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label htmlFor={id} className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        required
        value={value}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

function SourceModeToggle({ mode, onChange }: { mode: SourceMode; onChange: (mode: SourceMode) => void }) {
  return (
    <fieldset className="flex gap-[var(--space-3)]">
      <legend className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">Standard content</legend>
      <label className="flex items-center gap-[var(--space-1)]">
        <input type="radio" name="source-mode" checked={mode === "body"} onChange={() => onChange("body")} />
        Write it here
      </label>
      <label className="flex items-center gap-[var(--space-1)]">
        <input type="radio" name="source-mode" checked={mode === "source"} onChange={() => onChange("source")} />
        Link to a source
      </label>
    </fieldset>
  );
}

/** AC-004-01: creates a BrandStandard via CE-WRITE-1, shows the committed
 * version + PROV-O actor on success, field-anchors a 422 otherwise.
 */
export function StandardForm({ onCommitted }: { onCommitted: (iri: string) => void }) {
  const { values, mode, setMode, errors, submitting, result, setField, handleSubmit } =
    useStandardFormState(onCommitted);
  const bodyOrSourceKey = mode === "body" ? P.contentBody : P.sourceUri;

  if (result) {
    return (
      <p className="text-[length:var(--text-body)] text-[var(--color-text-default)]">
        Committed as version {result.versionIri}, by {result.actorIri}.
      </p>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-[var(--space-3)]">
      <TextField
        id="standard-content-type"
        label="Content type"
        value={values[P.contentType] ?? ""}
        error={errors[P.contentType]}
        onChange={(value) => setField(P.contentType, value)}
      />
      <SourceModeToggle mode={mode} onChange={setMode} />
      <TextField
        id="standard-content-body-or-source"
        label={mode === "body" ? "Content body" : "Source URL"}
        value={values[bodyOrSourceKey] ?? ""}
        error={errors[bodyOrSourceKey]}
        onChange={(value) => setField(bodyOrSourceKey, value)}
      />
      <TextField
        id="standard-effective-date"
        label="Effective date"
        type="date"
        value={values[P.effectiveDate] ?? ""}
        error={errors[P.effectiveDate]}
        onChange={(value) => setField(P.effectiveDate, value)}
      />
      <TextField
        id="standard-owner"
        label="Owner"
        value={values[P.owner] ?? ""}
        error={errors[P.owner]}
        onChange={(value) => setField(P.owner, value)}
      />
      <Button type="submit" disabled={submitting}>
        Save
      </Button>
    </form>
  );
}
