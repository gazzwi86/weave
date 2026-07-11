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
 * shipped ProjectCardResponse -- not rendered (see task receipt GAPS).
 * BE-V1-TASK-019: links to the project dashboard (not settings directly)
 * -- the dashboard is the primary destination when browsing existing
 * projects; settings stays reachable from a link on the dashboard itself.
 */
export function ProjectCard({ project }: { project: ProjectCardData }): React.JSX.Element {
  return (
    <Link href={`/build/projects/${encodeURIComponent(project.project_iri)}`} className="block">
      <Card className="transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-hover)] focus-visible:shadow-[var(--ring-focus)]">
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
      </Card>
    </Link>
  );
}
