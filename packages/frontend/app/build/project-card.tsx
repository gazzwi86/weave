import Link from "next/link";

import { Card, CardTitle } from "@/components/ui/card";
import { StatusPill, type Status } from "@/components/ui/status-pill";

import type { ProjectCard as ProjectCardData } from "./use-project-grid";

// refit-mock.html #sub-bld-registry's phase pill has its own vocabulary
// (building/live/archived) distinct from StatusPill's active/published/
// draft/custom set -- `label` carries the mock's text, `status` picks the
// closest tone (speccing ~ draft, building ~ active, live ~ published,
// archived ~ custom/muted).
const PHASE_PILL: Record<ProjectCardData["lifecycle_phase"], { status: Status; label: string }> = {
  Speccing: { status: "draft", label: "speccing" },
  Building: { status: "active", label: "building" },
  "Live monitoring": { status: "published", label: "live" },
  Archived: { status: "custom", label: "archived" },
};

/** One Registry card (`#sub-bld-registry`): name, lifecycle StatusPill,
 * owner. Task counts, budget bar, and "updated" timestamp are in the mock
 * but have no backing field on `ProjectCardResponse` (schemas/projects.py)
 * -- a residual gap distinct from G9-G12 (those cover epics/gates, not the
 * registry card), rendered as an honest pending note rather than fabricated.
 * BE-V1-TASK-019: links to the project dashboard (not settings directly)
 * -- the dashboard is the primary destination when browsing existing
 * projects; settings stays reachable from a link on the dashboard itself.
 */
export function ProjectCard({ project }: { project: ProjectCardData }): React.JSX.Element {
  const pill = PHASE_PILL[project.lifecycle_phase];
  return (
    <Card className="transition-[background-color] duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:bg-[var(--color-hover)] focus-visible:shadow-[var(--ring-focus)]">
      <Link
        href={`/build/projects/${encodeURIComponent(project.project_iri)}`}
        className="block"
      >
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <CardTitle className="text-[length:var(--text-h4)]">{project.name}</CardTitle>
          <StatusPill status={pill.status} label={pill.label} />
        </div>
        <p className="mt-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          Owner{" "}
          <span className="font-[var(--font-mono)]">
            {project.owner_iri ?? "Unassigned"}
          </span>
        </p>
        <p
          data-testid="project-card-meta-pending"
          className="mt-[var(--space-1)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]"
        >
          Not available yet — task counts and budget need a registry-card summary field.
        </p>
      </Link>
      {/* TASK-024 + v5 discoverability: the Request Studio (F-D20) and the
       * Decision Log are otherwise only reachable by hand-editing the URL
       * (CE-023 lesson) -- surface both as card actions. */}
      <div className="mt-[var(--space-2)] flex gap-[var(--space-3)]">
        <Link
          href={`/build/projects/${encodeURIComponent(project.project_iri)}/request`}
          className="text-[length:var(--text-caption)] text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)]"
        >
          Request build
        </Link>
        <Link
          href={`/build/projects/${encodeURIComponent(project.project_iri)}/decisions`}
          className="text-[length:var(--text-caption)] text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)]"
        >
          Decisions
        </Link>
      </div>
    </Card>
  );
}
