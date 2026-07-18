"use client";

import { useState } from "react";

import { PageHeaderSlot } from "@/components/templates/PageHeaderSlot";
import { Card, CardTitle } from "@/components/ui/card";

import { useBoard } from "./board/use-board";
import { DashboardActivityPanel } from "./dashboard-activity-panel";
import { DashboardGateBand, findPendingGateCard } from "./dashboard-gate-band";
import { DashboardKpiRow } from "./dashboard-kpi-row";
import { DashboardRoadmapPanel } from "./dashboard-roadmap-panel";
import { DashboardSpecLinks } from "./dashboard-spec-links";
import type { BlockersTilePayload, BudgetTilePayload, RibbonTilePayload } from "./dashboard-types";
import { ReviewGateDrawer } from "./review-gate-drawer";
import { useTile } from "./use-tile";

/** refit-mock.html `#sub-bld-dashboard`: gate band, KPI row, roadmap +
 * spec-links, recent activity. Replaces the earlier six-tile grid
 * (BE-V1-TASK-019) -- budget/blockers/ribbon are still per-tile fetches
 * (AC-1/AC-2 isolation preserved), demo/forecast/tasks/prompt-box/
 * self-improvement dropped, board/task-tree now drive the gate band + KPI
 * counts. Gaps: G9 (no epics endpoint -- KPI "epics created" stays
 * pending), G10 (no epic timeline data -- roadmap panel stays
 * pending-state), G11 (no live spec-artefact API -- Brief/PRD/Roadmap/Tech
 * spec/Epics open a static placeholder DocDrawer; "Task briefs" is real),
 * G12 (no pending-review-gates endpoint -- gate band derives from the
 * board's Review/QA lane).
 */
export function ProjectDashboard({ projectId }: { projectId: string }): React.JSX.Element {
  const { board } = useBoard(projectId);
  const budget = useTile<BudgetTilePayload>(projectId, "budget");
  const blockers = useTile<BlockersTilePayload>(projectId, "blockers");
  const ribbon = useTile<RibbonTilePayload>(projectId, "ribbon");
  const [reviewTaskId, setReviewTaskId] = useState<string | null>(null);

  const gateCard = findPendingGateCard(board);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <PageHeaderSlot title="Dashboard" subtitle="Where the build is, what it costs, and what needs you." />
      <DashboardGateBand board={board} onReview={setReviewTaskId} />
      <DashboardKpiRow board={board} budget={budget.data} />
      <div className="grid grid-cols-1 gap-[var(--space-4)] lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardTitle>Roadmap</CardTitle>
          <div className="mt-[var(--space-2)]">
            <DashboardRoadmapPanel />
          </div>
        </Card>
        <Card>
          <CardTitle>Spec — this project&apos;s source of truth</CardTitle>
          <div className="mt-[var(--space-2)]">
            <DashboardSpecLinks board={board} />
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>Recent build activity</CardTitle>
        <div className="mt-[var(--space-2)]">
          <DashboardActivityPanel blockers={blockers.data} ribbon={ribbon.data} />
        </div>
      </Card>
      <ReviewGateDrawer
        key={reviewTaskId ?? gateCard?.id ?? "none"}
        open={reviewTaskId !== null}
        onClose={() => setReviewTaskId(null)}
        projectId={projectId}
        taskId={reviewTaskId}
      />
    </div>
  );
}
