"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { NewProjectForm, type NewProjectFormValues } from "./new-project-form";

interface CreatedProject {
  project_iri: string;
}

async function createProject(
  values: NewProjectFormValues
): Promise<{ projectIri: string } | { error: string }> {
  try {
    const res = await fetch("/api/build/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        description: values.description || null,
        source_control: values.secretRef
          ? { provider: "github", token_secret_ref: values.secretRef }
          : null,
      }),
    });
    if (res.status !== 201) {
      return {
        error:
          res.status === 409 ? "A project with that name already exists." : "Unable to create the project.",
      };
    }
    const created = (await res.json()) as CreatedProject;
    return { projectIri: created.project_iri };
  } catch {
    return { error: "Unable to create the project — try again shortly." };
  }
}

/** "New project" modal (AC-8, FR-066) -- opens `NewProjectForm` in a
 * native `<dialog>`, which gives focus trap, Escape-close, and
 * focus-restore-to-trigger for free (accessibility.md §General rules). */
export function NewProjectModal({
  onCreated,
}: {
  onCreated: (projectIri: string) => void;
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(values: NewProjectFormValues): Promise<void> {
    setSaving(true);
    setError(null);
    const result = await createProject(values);
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    dialogRef.current?.close();
    onCreated(result.projectIri);
  }

  return (
    <>
      <Button onClick={() => dialogRef.current?.showModal()}>New project</Button>
      <dialog
        ref={dialogRef}
        className="m-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-6)] backdrop:bg-[var(--color-overlay)] backdrop:opacity-80"
      >
        <NewProjectForm
          saving={saving}
          error={error}
          onCancel={() => dialogRef.current?.close()}
          onSubmit={handleCreate}
        />
      </dialog>
    </>
  );
}
