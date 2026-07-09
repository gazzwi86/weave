const SLOTS = ["Data warehouse", "Source control", "Secrets manager"] as const;

/** AC-7: managed connectors are deferred to v1.0 (CLAUDE.md §Stack) --
 * these three slots exist so the surface is discoverable now, disabled. */
export function BindingSlots(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {SLOTS.map((slot) => (
        <div
          key={slot}
          aria-disabled="true"
          className="flex items-center justify-between rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-raised)] px-[var(--space-4)] py-[var(--space-3)] opacity-50"
        >
          <span className="text-[length:var(--text-body)] text-[var(--color-text-default)]">
            {slot}
          </span>
          <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
            Available when connectors ship
          </span>
        </div>
      ))}
    </div>
  );
}
