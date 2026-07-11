import Link from "next/link";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";

import type { ProjectCard as ProjectCardData } from "./use-project-grid";

// GAPS: lifecycle-phase chip colours are not pinned by a standard (phase is
// not a BPMO kind, not a color.md semantic status) -- this mapping is this
// task's own choice, flagged for QA rather than cited.
const PHASE_VARIANT: Record<ProjectCardData["lifecycle_phase"], BadgeProps["variant"]> = {
  Speccing: "info",
  Building: "neutral",
  "Live monitoring": "success",
  Archived: "neutral",
};

/** One Registry card (AC-1): name, derived phase, owner. `budget`/`demo
 * status` named in the brief's AC-1 text have no field on TASK-014's
 * shipped ProjectCardResponse -- not rendered (see task receipt GAPS). */
export function ProjectCard({ project }: { project: ProjectCardData }): React.JSX.Element {
  return (
    <Card className="transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-hover)] focus-visible:shadow-[var(--ring-focus)]">
      <Link
        href={`/build/projects/${encodeURIComponent(project.project_iri)}/settings`}
        className="block"
      >
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <CardTitle className="text-[length:var(--text-h4)]">{project.name}</CardTitle>
          <Badge variant={PHASE_VARIANT[project.lifecycle_phase]}>
            {project.lifecycle_phase}
          </Badge>
        </div>
        <p className="mt-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          Owner{" "}
          <span className="font-[var(--font-mono)]">
            {project.owner_iri ?? "Unassigned"}
          </span>
        </p>
      </Link>
      {/* TASK-024: makes the "Request application" form (F-D20) nav-reachable
       * -- previously only reachable by hand-editing the URL (CE-023 lesson). */}
      <Link
        href={`/build/projects/${encodeURIComponent(project.project_iri)}/request`}
        className="mt-[var(--space-2)] inline-block text-[length:var(--text-caption)] text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)]"
      >
        Request build
      </Link>
    </Card>
  );
}
