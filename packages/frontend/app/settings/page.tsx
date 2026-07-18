import { GeneralPanel } from "./general-panel";

/** Settings -> General (mock `#sub-set-general`): the settings index
 * route's landing page. Supersedes TASK-030 AC-7's Members-redirect, which
 * predates General existing in the IA -- the refit mock lists General
 * first/active in the settings rail. */
export default function SettingsPage() {
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        General
      </h1>
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        Workspace identity and defaults.
      </p>
      <GeneralPanel />
    </main>
  );
}
