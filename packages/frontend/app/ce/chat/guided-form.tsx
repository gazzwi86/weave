"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useKindShape } from "./use-kind-shape";
import type { KindEntry, Op, PropertyShape } from "./types";

interface ApplyResponseBody {
  ref_map?: Record<string, string>;
  violations?: { path: string | null; message: string }[];
}

const LABEL_FIELD = "label";
// Some BPMO kinds' SHACL shapes declare their own rdfs-label property
// (`authoring/imports.py`'s `_WEAVE_LABEL`). The form already has a fixed
// Label field wired to `add_node`'s own `label`, so this predicate is
// excluded from the shape-derived fields to avoid rendering it twice.
const LABEL_PREDICATE_IRI = "https://weave.io/ontology/label";

function isRequired(property: PropertyShape): boolean {
  return property.min_count !== null && property.min_count >= 1;
}

function extraFields(shape: KindEntry): PropertyShape[] {
  return shape.properties.filter((property) => property.path !== LABEL_PREDICATE_IRI);
}

/** AC-006-08: every `sh:minCount 1` field left empty blocks submit and
 * carries the SHACL constraint label back to the field.
 */
function validateFields(shape: KindEntry, values: Record<string, string>): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values[LABEL_FIELD]?.trim()) errors[LABEL_FIELD] = "Label is required (min count 1)";
  for (const property of extraFields(shape)) {
    if (isRequired(property) && !values[property.path]?.trim()) {
      errors[property.path] = `${property.name} is required (min count 1)`;
    }
  }
  return errors;
}

function buildOperation(kindIri: string, shape: KindEntry, values: Record<string, string>): Op {
  const properties: Record<string, unknown> = {};
  for (const property of extraFields(shape)) {
    if (values[property.path]) properties[property.path] = values[property.path];
  }
  return { op: "add_node", ref: "form1", kind: kindIri, label: values[LABEL_FIELD] ?? "", properties };
}

/** AC-006-09/-10: dispatches the single-entity `add_node` op and turns the
 * response into either a committed IRI or a `path -> message` field-error
 * map (SHACL violations mapped back onto the field that caused them).
 */
async function submitForm(op: Op): Promise<{ iri: string | null; errors: Record<string, string> }> {
  const res = await fetch("/api/operations/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations: [op] }),
  });
  const body = (await res.json()) as ApplyResponseBody;
  if (res.status === 201) {
    return { iri: body.ref_map?.form1 ?? null, errors: {} };
  }
  const errors: Record<string, string> = {};
  for (const violation of body.violations ?? []) {
    errors[violation.path ?? LABEL_FIELD] = violation.message;
  }
  return { iri: null, errors };
}

function FormField({
  id,
  label,
  required,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  required: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label htmlFor={id} className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        {label}
        {required && " *"}
      </label>
      <Input id={id} value={value} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
      {error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

/** Owns the form's field values/errors/submit lifecycle, split out of
 * `GuidedForm` to keep the component body under the Law E line budget.
 */
function useGuidedFormState(kindIri: string, shape: KindEntry | null) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [committedIri, setCommittedIri] = useState<string | null>(null);

  const setField = (path: string, value: string) => setValues((prev) => ({ ...prev, [path]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!shape) return;
    const fieldErrors = validateFields(shape, values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      const { iri, errors: violationErrors } = await submitForm(buildOperation(kindIri, shape, values));
      if (iri) setCommittedIri(iri);
      setErrors(violationErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return { values, errors, submitting, committedIri, setField, handleSubmit };
}

function SuccessPanel({ iri, onClose }: { iri: string; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-[var(--space-2)]">
      <p>Created {iri}.</p>
      <a href={`/explorer?focus=${encodeURIComponent(iri)}`} className="underline text-[var(--color-accent-primary)]">
        View in graph
      </a>
      <Button type="button" onClick={onClose}>
        Close
      </Button>
    </div>
  );
}

/** TASK-006 E11-S2: a form whose fields are a live projection of the
 * selected BPMO kind's SHACL shape (AC-006-07), re-fetched fresh on every
 * open (AC-006-11) via `useKindShape` -- never a stale cached form.
 */
export function GuidedForm({ kindIri, onClose }: { kindIri: string; onClose: () => void }) {
  const { shape } = useKindShape(kindIri);
  const { values, errors, submitting, committedIri, setField, handleSubmit } = useGuidedFormState(kindIri, shape);

  if (!shape) return <p>Loading form...</p>;
  if (committedIri) return <SuccessPanel iri={committedIri} onClose={onClose} />;

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-[var(--space-3)]">
      <FormField
        id="ce-form-label"
        label="Label"
        required
        value={values[LABEL_FIELD] ?? ""}
        error={errors[LABEL_FIELD]}
        onChange={(value) => setField(LABEL_FIELD, value)}
      />
      {extraFields(shape).map((property) => (
        <FormField
          key={property.path}
          id={`ce-form-${property.path}`}
          label={property.name}
          required={isRequired(property)}
          value={values[property.path] ?? ""}
          error={errors[property.path]}
          onChange={(value) => setField(property.path, value)}
        />
      ))}
      <Button type="submit" disabled={submitting}>
        Save
      </Button>
    </form>
  );
}
