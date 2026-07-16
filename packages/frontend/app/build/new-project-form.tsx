"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface NewProjectFormValues {
  name: string;
  description: string;
  secretRef: string;
}

/** Fields for the "New project" modal (AC-8): name + description, plus an
 * optional source-control secret reference (AC-6 -- the only field on
 * TASK-014's CreateProjectRequest that touches secret config: reference
 * name only, no reveal affordance, because there is nothing behind it to
 * reveal client-side). Split out of `NewProjectModal` to stay under the
 * function-length budget (Law E). */
export function NewProjectForm({
  saving,
  error,
  onCancel,
  onSubmit,
}: {
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (values: NewProjectFormValues) => void;
}): React.JSX.Element {
  const [values, setValues] = useState<NewProjectFormValues>({
    name: "",
    description: "",
    secretRef: "",
  });
  const [nameError, setNameError] = useState<string | null>(null);

  function handleCreate(): void {
    if (!values.name.trim()) {
      setNameError("Name is required.");
      return;
    }
    setNameError(null);
    onSubmit(values);
  }

  return (
    <form
      method="dialog"
      className="flex flex-col gap-[var(--space-4)]"
      onSubmit={(e) => e.preventDefault()}
    >
      <h2 className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        New project
      </h2>
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">Name</span>
        <Input
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          required
        />
        {nameError && (
          <span role="alert" className="text-[length:var(--text-label)] text-[var(--color-danger)]">
            {nameError}
          </span>
        )}
      </label>
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          Description
        </span>
        <textarea
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]"
        />
      </label>
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          Secret reference (optional)
        </span>
        <Input
          value={values.secretRef}
          onChange={(e) => setValues({ ...values, secretRef: e.target.value })}
        />
        {values.secretRef && (
          <Badge variant="neutral" className="w-fit font-[var(--font-mono)]">
            {values.secretRef}
          </Badge>
        )}
      </label>
      {error && (
        <p role="alert" className="text-[var(--color-danger)]">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-[var(--space-2)]">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={saving} onClick={handleCreate}>
          Create
        </Button>
      </div>
    </form>
  );
}
