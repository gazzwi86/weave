import { auth } from "@/auth";
import { ExplorerCanvasLoader } from "@/components/explorer/explorer-canvas-loader";
import { ExplorerTour } from "@/components/explorer/explorer-tour";
import { getSessionClaims } from "@/lib/auth/session-claims";

interface ExplorerPageProps {
  /** ONB-V1-TASK-002 AC-002-01: `?tour=completeness-map` is the
   * help-launcher's deep link into `tour.ge.completeness-map`. */
  searchParams: Promise<{ tour?: string }>;
}

/** FR-001..FR-005: Graph Explorer's whole-company force canvas. Protected by
 * middleware.ts (not in PUBLIC_PATHS) -- unauthenticated viewers are
 * redirected to /auth/login before this ever renders. Resolves the caller's
 * role once server-side (same shape as project-settings-page.tsx) so
 * ExplorerInteractions' TASK-023 AC-7 canEditCanvas gate has a real role to
 * check -- UX-only; CE-WRITE-1 independently rejects server-side. */
export default async function ExplorerPage({ searchParams }: ExplorerPageProps) {
  const session = await auth();
  const { role } = getSessionClaims(session?.accessToken);
  const { tour } = await searchParams;

  return (
    <main data-tour-id="ge.canvas" className="flex h-screen flex-col overflow-hidden">
      {/* The mock shows no visible page title (the breadcrumb carries context),
          but a11y requires a top-level heading (axe `page-has-heading-one`), so
          the title stays as a visually-hidden sr-only h1 -- same sr-only pattern
          the shell dialogs use. */}
      <h1 className="sr-only">Graph Explorer</h1>
      <ExplorerCanvasLoader role={role} />
      <ExplorerTour tourParam={tour ?? null} />
    </main>
  );
}
