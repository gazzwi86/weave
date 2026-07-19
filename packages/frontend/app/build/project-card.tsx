import Link from "next/link";

import { Card, CardTitle } from "@/components/ui/card";
import { StatusPill, type Status } from "@/components/ui/status-pill";

import { useProjectTaskCounts } from "./use-project-task-counts";
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

/** B1: the card's task-count/budget line -- extracted so `ProjectCard`
 * stays under Law E's 50-line function cap. `counts === null` covers both
 * "still loading" and "fetch failed" (see `useProjectTaskCounts`).
 */
function TaskCountMeta({ counts }: { counts: { total: number; done: number } | null }): React.JSX.Element {
  if (!counts) {
    return (
      <p
        data-testid="project-card-meta-pending"
        className="mt-[var(--space-1)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]"
      >
        Task counts aren&apos;t available yet. Budget: —
      </p>
    );
  }
  return (
    <p className="mt-[var(--space-1)] flex gap-[var(--space-2)] text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
      <span data-testid="project-card-task-counts">
        {counts.done}/{counts.total} tasks done
      </span>
      <span data-testid="project-card-budget">Budget: —</span>
    </p>
  );
}

/** One Registry card (`#sub-bld-registry`): name, lifecycle StatusPill,
 * owner, task counts. B1 (docs/design/remediation-2-api-gaps.md): task
 * counts come from the per-project epic rollup (G9/G10), fetched lazily
 * per card rather than added to the listing endpoint -- a rollup field on
 * every `GET /api/projects` row would run an aggregate query per project
 * on every grid page load, while this only pays for cards actually
 * rendered. Budget stays "--": no per-project budget source exists in the
 * backend (the billing budget gate is tenant/workspace-scoped, not
 * per-project) -- an honest placeholder, not a fabricated number. The
 * "updated" timestamp remains a residual gap (no backing field anywhere).
 * BE-V1-TASK-019: links to the project dashboard (not settings directly)
 * -- the dashboard is the primary destination when browsing existing
 * projects; settings stays reachable from a link on the dashboard itself.
 */
export function ProjectCard({ project }: { project: ProjectCardData }): React.JSX.Element {
  const pill = PHASE_PILL[project.lifecycle_phase];
  const taskCounts = useProjectTaskCounts(project.project_iri);
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
        <TaskCountMeta counts={taskCounts} />
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
