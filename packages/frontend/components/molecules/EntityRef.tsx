import { cn } from "@/lib/utils";

export interface EntityRefProps {
  /** Friendly label shown first -- the primary, human-facing identity. */
  label: string;
  /** Machine identifier (IRI or short id), rendered second in `--font-mono`. */
  id: string;
  className?: string;
}

/**
 * Label-first entity reference: the friendly label carries visual weight,
 * the machine id is a secondary mono chip -- never a bare IRI on its own
 * (design-assessment F-D08 / `jtbd.md` "Instances / Data" success criterion).
 */
export function EntityRef({ label, id, className }: EntityRefProps) {
  return (
    <span className={cn("inline-flex items-center gap-[var(--space-2)]", className)}>
      <span className="text-[length:var(--text-body)] text-[var(--color-text-default)]">{label}</span>
      <span className="rounded-[var(--radius-sm)] bg-[var(--color-raised)] px-[var(--space-2)] text-[length:var(--text-mono-sm)] text-[var(--color-text-muted)] font-[var(--font-mono)]">
        {id}
      </span>
    </span>
  );
}
