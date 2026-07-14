import { auth } from "@/auth";
import { ExplorerCanvasLoader } from "@/components/explorer/explorer-canvas-loader";
import { getSessionClaims } from "@/lib/auth/session-claims";

/** FR-001..FR-005: Graph Explorer's whole-company force canvas. Protected by
 * middleware.ts (not in PUBLIC_PATHS) -- unauthenticated viewers are
 * redirected to /auth/login before this ever renders. Resolves the caller's
 * role once server-side (same shape as project-settings-page.tsx) so
 * ExplorerInteractions' TASK-023 AC-7 canEditCanvas gate has a real role to
 * check -- UX-only; CE-WRITE-1 independently rejects server-side. */
export default async function ExplorerPage() {
  const session = await auth();
  const { role } = getSessionClaims(session?.accessToken);

  return (
    <main data-tour-id="ge.canvas" className="flex h-screen flex-col overflow-hidden">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)] p-[var(--space-6)]">
        Graph Explorer
      </h1>
      <ExplorerCanvasLoader role={role} />
    </main>
  );
}
