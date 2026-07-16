"use client";

import { useState } from "react";

import { EntityConfirmation } from "@/components/templates/EntityConfirmation";
import { FormDrawerPage } from "@/components/templates/FormDrawerPage";
import { Button } from "@/components/ui/button";
import { EntityPicker } from "@/components/ui/entity-picker";
import { Input } from "@/components/ui/input";

import type { KindEntry, PropertyShape } from "../chat/types";
import { checkFieldStructural } from "./structural-check";
import { useTypeahead } from "./use-typeahead";

interface ApplyResponseBody {
  ref_map?: Record<string, string>;
  activity_iri?: string;
  violations?: { path: string | null; message: string }[];
}

interface AuthoringDrawerProps {
  shape: KindEntry;
  mode: "create" | "edit";
  targetIri?: string;
  initialValues?: Record<string, string>;
  onClose: () => void;
}

// AC-7: friendly label + mono id, never the raw IRI -- `https://.../foo`
// IRIs split on "/", `urn:activity:foo`-style IRIs have no "/" so fall
// back to splitting on ":".
function shortId(iri: string): string {
  return iri.split("/").pop()?.split(":").pop() ?? iri;
}

function buildOp(
  mode: "create" | "edit",
  shape: KindEntry,
  values: Record<string, string>,
  targetIri: string | undefined
) {
  return mode === "create"
    ? { op: "add_node" as const, ref: "form1", kind: shape.iri, label: values.label ?? "", properties: values }
    : { op: "update_node" as const, iri: targetIri ?? "", properties: values };
}

function violationsToFieldErrors(violations: ApplyResponseBody["violations"]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const violation of violations ?? []) {
    errors[violation.path ?? "label"] = violation.message;
  }
  return errors;
}

async function submitOperation(
  mode: "create" | "edit",
  shape: KindEntry,
  values: Record<string, string>,
  targetIri: string | undefined
): Promise<{ committedIri: string | null; activityIri: string | null; errors: Record<string, string> }> {
  const res = await fetch("/api/operations/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operations: [buildOp(mode, shape, values, targetIri)] }),
  });
  const body = (await res.json()) as ApplyResponseBody;
  if (res.status !== 201) {
    return { committedIri: null, activityIri: null, errors: violationsToFieldErrors(body.violations) };
  }
  const iri = mode === "create" ? (body.ref_map?.form1 ?? null) : (targetIri ?? null);
  return { committedIri: iri, activityIri: body.activity_iri ?? null, errors: {} };
}

/** AC-5's picker field: object-typed property renders as a search-and-
 * select entity picker, never free text.
 */
function RelationshipField({
  property,
  value,
  error,
  onChange,
}: {
  property: PropertyShape;
  value: string;
  error?: string;
  onChange: (iri: string) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const options = useTypeahead(searchTerm);
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label htmlFor={`drawer-${property.path}`} className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        {property.name}
        {property.min_count && property.min_count >= 1 ? " *" : ""}
      </label>
      <EntityPicker
        id={`drawer-${property.path}`}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        options={options}
        selected={value ? { iri: value, label: value } : null}
        onSelect={(option) => onChange(option.iri)}
        error={Boolean(error)}
      />
      {error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

function TextField({
  property,
  value,
  error,
  onBlurCheck,
  onChange,
}: {
  property: PropertyShape;
  value: string;
  error?: string;
  onBlurCheck: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <label htmlFor={`drawer-${property.path}`} className="text-[length:var(--text-small)] text-[var(--color-text-subtle)]">
        {property.name}
        {property.min_count && property.min_count >= 1 ? " *" : ""}
      </label>
      <Input
        id={`drawer-${property.path}`}
        value={value}
        error={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlurCheck}
      />
      {error && <p className="text-[length:var(--text-small)] text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}

function useDrawerState(shape: KindEntry, initialValues: Record<string, string>) {
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (path: string, value: string) => setValues((prev) => ({ ...prev, [path]: value }));

  const runBlurCheck = (property: PropertyShape) => {
    const violation = checkFieldStructural(property, values[property.path] ?? "");
    setErrors((prev) => ({ ...prev, [property.path]: violation ?? "" }));
  };

  return { values, errors, setErrors, setField, runBlurCheck, shape };
}

const LABEL_SHAPE: PropertyShape = {
  path: "label",
  name: "Label",
  is_relationship: false,
  min_count: 1,
  max_count: 1,
  severity: "Violation",
};

// Some kinds' SHACL shapes declare their own rdfs:label property; the
// dedicated Label field above already wires `add_node.label`, so drop the
// duplicate (mirrors GuidedForm) — otherwise the kind shows two "Label *"
// fields and the required SHACL one blocks save.
const LABEL_PREDICATE_IRI = "https://weave.io/ontology/label";

type DrawerState = ReturnType<typeof useDrawerState>;

/** The label field + one field per SHACL property, split out of
 * `AuthoringDrawer` to keep it under the Law E function-length budget.
 */
function DrawerFields({ shape, values, errors, setField, runBlurCheck }: DrawerState) {
  return (
    <>
      <TextField
        property={LABEL_SHAPE}
        value={values.label ?? ""}
        error={errors.label}
        onBlurCheck={() => runBlurCheck(LABEL_SHAPE)}
        onChange={(value) => setField("label", value)}
      />
      {shape.properties
        .filter((property) => property.path !== LABEL_PREDICATE_IRI)
        .map((property) =>
        property.is_relationship ? (
          <RelationshipField
            key={property.path}
            property={property}
            value={values[property.path] ?? ""}
            error={errors[property.path]}
            onChange={(iri) => setField(property.path, iri)}
          />
        ) : (
          <TextField
            key={property.path}
            property={property}
            value={values[property.path] ?? ""}
            error={errors[property.path]}
            onBlurCheck={() => runBlurCheck(property)}
            onChange={(value) => setField(property.path, value)}
          />
        )
      )}
    </>
  );
}

/** AC-5/AC-6/AC-7: guided SHACL form in a drawer -- kind shown in a
 * persistent header (never disappearing after selection, the direct F-D13
 * fix), object properties as entity pickers (AC-5), on-blur structural
 * check (AC-6) plus submit-time 422 -> field mapping, and a friendly-label
 * + mono-id confirmation (AC-7, `EntityRef`, never a raw IRI).
 */
export function AuthoringDrawer({ shape, mode, targetIri, initialValues, onClose }: AuthoringDrawerProps) {
  const drawerState = useDrawerState(shape, initialValues ?? {});
  const { values, setErrors } = drawerState;
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState<{ iri: string; activityIri: string | null } | null>(null);

  if (confirmed) {
    return (
      <EntityConfirmation
        label={values.label ?? shape.label}
        id={shortId(confirmed.activityIri ?? confirmed.iri)}
        onClose={onClose}
      />
    );
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await submitOperation(mode, shape, values, targetIri);
      if (result.committedIri) {
        setConfirmed({ iri: result.committedIri, activityIri: result.activityIri });
      } else {
        setErrors(result.errors);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDrawerPage
      title={shape.label}
      fields={<DrawerFields {...drawerState} />}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} loading={submitting}>
            Save
          </Button>
        </>
      }
    />
  );
}
