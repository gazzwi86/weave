"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PathPickerDialog, ROLE_PATH_LABELS, type RolePath } from "@/components/onboarding/path-picker-dialog";

import { useOnboardingPath } from "./use-onboarding-path";

/** ONB-TASK-006 AC-006-04: "change my onboarding path" settings surface. */
export default function OnboardingPathSettingsPage() {
  const { path, loadError, changePath } = useOnboardingPath();
  const [pickerOpen, setPickerOpen] = useState(false);

  if (loadError) {
    return <p className="text-[var(--color-text-muted)]">Couldn&apos;t load your onboarding path.</p>;
  }
  if (!path) {
    return <p className="text-[var(--color-text-muted)]">Loading...</p>;
  }

  return (
    <section className="flex flex-col gap-[var(--space-4)]">
      <div>
        <h1 className="text-[length:var(--text-h3)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Onboarding path
        </h1>
        <p className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          Current path: <strong>{ROLE_PATH_LABELS[path.role_path]}</strong>
          {path.path_variant === "read_only" ? " (read-only)" : ""}
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={() => setPickerOpen(true)}>
        Change my onboarding path
      </Button>
      <PathPickerDialog
        open={pickerOpen}
        current={path.role_path}
        onCancel={() => setPickerOpen(false)}
        onChoose={(next: RolePath) => {
          setPickerOpen(false);
          void changePath(next);
        }}
      />
    </section>
  );
}
