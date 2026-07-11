"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SKOS_DEFINITION, SKOS_PREF_LABEL, createGlossaryTerm } from "@/lib/glossary/create-glossary-term";

interface GlossaryCreateFormProps {
  prefill: string;
  onCreated: (iri: string) => void;
}

interface FormValues {
  prefLabel: string;
  lang: string;
  definition: string;
}

const LANG_FIELD = "lang";

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!values.prefLabel.trim()) errors[SKOS_PREF_LABEL] = "Preferred label is required.";
  if (!values.lang.trim()) errors[LANG_FIELD] = "Language is required.";
  if (!values.definition.trim()) errors[SKOS_DEFINITION] = "Definition is required.";
  return errors;
}

function FormField({
  id,
  label,
  value,
  error,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label htmlFor={id} className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        {label}
      </label>
      <Input id={id} value={value} aria-invalid={Boolean(error)} onChange={(event) => onChange(event.target.value)} />
      {error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

/** Owns the create form's field/error/submit state, split out of
 * `GlossaryCreateForm` to keep the component body under the Law E line
 * budget (mirrors `guided-form.tsx`'s `useGuidedFormState` split). */
function useGlossaryCreateFormState(prefill: string, onCreated: (iri: string) => void) {
  const [values, setValues] = useState<FormValues>({ prefLabel: prefill, lang: "en", definition: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const setField = (field: keyof FormValues, value: string) =>
    setValues((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fieldErrors = validate(values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      const result = await createGlossaryTerm(values);
      if (result.type === "ok") {
        onCreated(result.iri);
      } else if (result.type === "violations") {
        setErrors(result.errors);
      } else {
        setErrors({ [SKOS_PREF_LABEL]: "Could not create the term. Try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return { values, errors, submitting, setField, handleSubmit };
}

/** AC-002-02/-04: the empty-state's create pipeline (`pseudocode:
 * emptyState(q) -> CreateTermForm(prefill=q)`) -- punned owl:Class typing
 * and a lang-tagged prefLabel via `createGlossaryTerm`, with 422
 * violations mapped back onto the field that caused them (ADR-022: a
 * focused component, not a `GuidedForm` extension). */
export function GlossaryCreateForm({ prefill, onCreated }: GlossaryCreateFormProps) {
  const { values, errors, submitting, setField, handleSubmit } = useGlossaryCreateFormState(prefill, onCreated);

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-[var(--space-3)]">
      <FormField
        id="glossary-preflabel"
        label="Preferred label"
        value={values.prefLabel}
        error={errors[SKOS_PREF_LABEL]}
        onChange={(value) => setField("prefLabel", value)}
      />
      <FormField
        id="glossary-lang"
        label="Language"
        value={values.lang}
        error={errors[LANG_FIELD]}
        onChange={(value) => setField(LANG_FIELD, value)}
      />
      <FormField
        id="glossary-definition"
        label="Definition"
        value={values.definition}
        error={errors[SKOS_DEFINITION]}
        onChange={(value) => setField("definition", value)}
      />
      <Button type="submit" disabled={submitting}>
        Create term
      </Button>
    </form>
  );
}
