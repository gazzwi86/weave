"use client";

import Link from "next/link";

import { Card, CardTitle } from "@/components/ui/card";

import { EMPTY_FILTERS, useProjectGrid } from "../use-project-grid";

/** BE-V1-TASK-017 mount point: nav-items.ts "Kanban" entry lands here first
 * (the board itself is project-scoped -- `/build/projects/[id]/board`), a
 * thin re-use of the Registry's own project-fetch hook, links swapped to
 * point at each project's board instead of its settings page.
 */
export default function BoardLandingPage(): React.JSX.Element {
  const { page, loadError } = useProjectGrid(EMPTY_FILTERS);

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Kanban boards
      </h1>
      {loadError && <p role="alert">Could not load projects.</p>}
      {!loadError && !page && <p data-testid="board-picker-loading">Loading…</p>}
      {page && (
        <ul className="flex flex-col gap-[var(--space-2)]">
          {page.items.map((project) => (
            <li key={project.project_iri}>
              <Link href={`/build/projects/${encodeURIComponent(project.project_iri)}/board`}>
                <Card className="hover:bg-[var(--color-hover)]">
                  <CardTitle>{project.name}</CardTitle>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
