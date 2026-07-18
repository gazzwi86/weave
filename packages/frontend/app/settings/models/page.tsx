import { auth } from "@/auth";
import { getSessionClaims } from "@/lib/auth/session-claims";

import { ModelsPanel } from "./models-panel";

/** Admin-only Models & AI surface (mock's `#sub-set-models`, "Admin only").
 * The rail already hides this for non-admins (nav-items.ts `adminOnly`);
 * this server-side check keeps a direct URL visit honest too -- same
 * convention as app/settings/workspaces/page.tsx. The backend enforces the
 * real admin requirement on `PUT /api/billing/caps` (403 -> mapped message
 * in models-panel.tsx). */
export default async function SettingsModelsPage() {
  const session = await auth();
  const { role } = getSessionClaims(session?.accessToken);

  if (role !== "admin") {
    return (
      <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Models &amp; AI
        </h1>
        <p data-testid="models-denied" className="text-[var(--color-text-muted)]">
          Models &amp; AI is available to workspace admins only.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Models &amp; AI
      </h1>
      <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
        Which Claude models Weave uses, and what it may spend. Admin only.
      </p>
      <ModelsPanel />
    </main>
  );
}
