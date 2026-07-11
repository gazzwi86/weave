import { ExplorerCanvasLoader } from "@/components/explorer/explorer-canvas-loader";

/** FR-001..FR-005: Graph Explorer's whole-company force canvas. Protected by
 * middleware.ts (not in PUBLIC_PATHS) -- unauthenticated viewers are
 * redirected to /auth/login before this ever renders. */
export default function ExplorerPage() {
  return (
    <main data-tour-id="ge.canvas" className="flex h-screen flex-col overflow-hidden">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)] p-[var(--space-6)]">
        Graph Explorer
      </h1>
      <ExplorerCanvasLoader />
    </main>
  );
}
