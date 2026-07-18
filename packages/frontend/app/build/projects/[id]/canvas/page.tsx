import { PageHeaderSlot } from "@/components/templates/PageHeaderSlot";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";

/** T6 placeholder (docs/specs/features/T6_PROJECT_EXPLORER_SPEC.md): the
 * project-scoped Explorer -- a project-centric view for building out and
 * retiring systems/processes as a project is delivered -- is feature-scale
 * and deferred (user decision, 2026-07-18). This route ships the intent
 * only: nav entry + a coming-soon surface, no real graph or backend.
 *
 * Repurposes `/build/ge-canvas-preview`'s ambition, not its route: that
 * page stays a separate, dev/test-only host for the GE-CANVAS-1
 * conformance e2e suite (`tests/e2e/ge-canvas-1-*.spec.ts`), unrelated to
 * this user-facing nav entry -- redirecting or removing it would break
 * those specs.
 *
 * No `params`/project id yet -- nothing on this placeholder is
 * project-scoped until the real canvas lands. */
export default function ProjectCanvasPage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <PageHeaderSlot
        eyebrow="Project"
        title="Model canvas"
        subtitle="A project-scoped view of your company model — see the processes, systems and data this project creates, affects, and retires as it's delivered. Coming soon."
      />
      <Card className="flex flex-1 flex-col items-center justify-center gap-[var(--space-3)] text-center">
        <Icon name="graph" size={32} className="text-[var(--color-text-subtle)]" />
        <p className="text-[length:var(--text-body)] text-[var(--color-text-muted)]">
          Nothing to show yet — the project canvas is on the roadmap.
        </p>
        <Badge variant="neutral">soon</Badge>
      </Card>
    </main>
  );
}
