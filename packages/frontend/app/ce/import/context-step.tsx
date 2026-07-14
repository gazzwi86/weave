"use client";

import { type ChangeEvent, useState } from "react";

import type { ImportContext } from "./use-import";

const FIELDS: { key: keyof ImportContext; label: string }[] = [
  { key: "source_system", label: "Source system" },
  { key: "owner", label: "Owner" },
  { key: "date_of_truth", label: "Date of truth" },
  { key: "sensitivity", label: "Sensitivity" },
  { key: "context", label: "Notes" },
];

interface ContextStepProps {
  uploading: boolean;
  onUpload: (file: File, context: ImportContext) => void;
}

/** CE-V1-TASK-019 (AC-008-01): FR-044's optional pre-ingestion context
 * fields. Every field is optional -- picking a file submits immediately
 * with whatever's filled in, so skipping the step entirely still proceeds.
 */
export function ContextStep({ uploading, onUpload }: ContextStepProps) {
  const [fields, setFields] = useState<ImportContext>({});

  const handleFieldChange = (key: keyof ImportContext) => (event: ChangeEvent<HTMLInputElement>) => {
    setFields((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onUpload(file, fields);
    event.target.value = "";
  };

  return (
    <section aria-label="Import context" className="flex flex-col gap-[var(--space-3)]">
      <div className="flex flex-col gap-[var(--space-2)]">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-[var(--space-1)]">
            <label
              htmlFor={`ce-import-${key}`}
              className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]"
            >
              {label} (optional)
            </label>
            <input
              id={`ce-import-${key}`}
              type="text"
              value={fields[key] ?? ""}
              onChange={handleFieldChange(key)}
              className="rounded-[var(--radius-base)] border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-2)] py-[var(--space-1)] text-[var(--color-text-default)]"
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-[var(--space-1)]">
        <label
          htmlFor="ce-import-upload"
          className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]"
        >
          Upload document
        </label>
        <input id="ce-import-upload" type="file" onChange={handleFileChange} disabled={uploading} />
      </div>
    </section>
  );
}
