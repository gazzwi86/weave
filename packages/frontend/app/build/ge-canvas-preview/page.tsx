import { notFound } from "next/navigation";

import { GraphCanvas } from "@/lib/explorer/public-api";
import type { GraphCanvasProps } from "@/lib/explorer/public-api";

/** TASK-029: the GE-CANVAS-1 conformance suite's stand-in "host route" --
 * a bare page mounting `GraphCanvas` with zero Explorer chrome (AC-4), the
 * way ge-canvas-1.md's component-context diagram shows Build's project
 * view doing. Build hasn't decomposed its own project-canvas embed yet
 * (external, post-M2-unblock work) -- this route exists so the conformance
 * suite (the Build-M2 unblock evidence, AC-3) can drive a real mount
 * through the package public API, not a bespoke test double. Dev/test only
 * -- 404s in production. */
interface GraphCanvasPreviewSearchParams {
  source?: string;
  filterByIri?: string;
  mode?: string;
  readonly?: string;
  version?: string;
}

export default async function GraphCanvasPreviewPage({
  searchParams,
}: {
  searchParams: Promise<GraphCanvasPreviewSearchParams>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = await searchParams;
  const props: GraphCanvasProps = {
    source: params.source ?? "whole-company",
    filterByIri: params.filterByIri,
    mode: (params.mode ?? "force") as GraphCanvasProps["mode"],
    readonly: params.readonly === "true",
    version: params.version,
  };

  return (
    // flex/h-screen matches app/explorer/page.tsx's own container -- the
    // canvas's inner `flex-1 min-h-0` div needs a flex-column ancestor with
    // a definite height (see explorer-canvas.tsx's own comment).
    <main className="flex h-screen flex-col overflow-hidden">
      {/* axe page-has-heading-one: bare host route has no Explorer chrome
       * (AC-4), but screen readers still need a discoverable page title. */}
      <h1 className="sr-only">GE-CANVAS-1 preview</h1>
      <GraphCanvas {...props} />
    </main>
  );
}
