import { useVersions } from "@/app/ce/versions/use-versions";

export interface VersionSelectProps {
  value: string;
  onChange: (version: string) => void;
}

/** CE-V1-TASK-032 AC-8: a labelled version control (never a bare unlabeled
 * text input) resolved from CE-READ-1's version list, defaulting to
 * "latest". Reuses `useVersions` (PLAT-V1-TASK-026-era `/api/proxy/ontology
 * /versions` proxy) rather than a second fetch of the same list. */
export function VersionSelect({ value, onChange }: VersionSelectProps) {
  const { versions } = useVersions();

  return (
    <label className="flex items-center gap-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)]">
      Version:
      <select
        aria-label="Version"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-default)]"
      >
        <option value="latest">latest</option>
        {versions.map((entry) => (
          <option key={entry.version_iri} value={entry.version_iri}>
            {entry.semver}
          </option>
        ))}
      </select>
    </label>
  );
}
