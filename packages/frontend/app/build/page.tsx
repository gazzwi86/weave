import { RegistryGrid } from "./registry-grid";

/** Build engine Registry (TASK-015, AC-1/AC-2/AC-8): the project list --
 * card grid + filter bar. Data fetching is a client island
 * (`RegistryGrid`); this shell is the server-rendered page chrome. */
export default function BuildRegistryPage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-6)] p-[var(--space-6)]">
      <div className="flex flex-col gap-[var(--space-1)]">
        <h1 className="text-[length:var(--text-h1)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Registry
        </h1>
        <p className="text-[length:var(--text-body)] text-[var(--color-text-muted)]">
          Every Build project your company has spun up.
        </p>
      </div>
      <RegistryGrid />
    </main>
  );
}
