import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";

import { WorkspacesPanel } from "./workspaces-panel";

/** Admin-only provisioning surface (IA §5: create workspace + first admin).
 * The rail already hides this for non-admins; this server-side check keeps a
 * direct URL visit honest too (display-only — the backend enforces the real
 * admin requirement on POST /tenants/{id}/workspaces). */
export default async function SettingsWorkspacesPage() {
  const session = await auth();
  const { role } = getSessionClaims(session?.accessToken);

  if (role !== "admin") {
    return (
      <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Workspaces
        </h1>
        <p data-testid="workspaces-denied" className="text-[var(--color-text-muted)]">
          Workspace provisioning is available to workspace admins only.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Workspaces
      </h1>
      <WorkspacesPanel />
    </main>
  );
}
