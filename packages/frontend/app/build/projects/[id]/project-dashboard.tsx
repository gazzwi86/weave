"use client";

import Link from "next/link";

import type {
  BlockersTilePayload,
  BudgetTilePayload,
  DemoTilePayload,
  ForecastTilePayload,
  RibbonTilePayload,
  SelfImprovementItem,
  TaskCountsTilePayload,
} from "./dashboard-types";
import { SelfImprovementCard } from "./self-improvement-card";
import { Tile } from "./tile";
import { useTile } from "./use-tile";

function DemoTileBody({ data }: { data: DemoTilePayload }): React.JSX.Element {
  return (
    <>
      <p>{data.output_location_ref ?? "Not yet deployed"}</p>
      {data.last_run_status === "failed" && (
        <p className="text-[var(--color-status-danger)]">
          Deploy failed — showing last successful demo
        </p>
      )}
    </>
  );
}

function BudgetTileBody({ data }: { data: BudgetTilePayload }): React.JSX.Element {
  return (
    <>
      <p>estimated ${data.total_estimate_usd.toFixed(2)}</p>
      <p>{data.level ? `capped at ${data.level}` : "no cap configured"}</p>
    </>
  );
}

function ForecastTileBody({ data }: { data: ForecastTilePayload }): React.JSX.Element {
  return (
    <>
      <p>estimated ${data.forecast_usd.toFixed(2)}</p>
      <p>
        {data.forecast_inputs.completed_count} done / {data.forecast_inputs.remaining_count}{" "}
        remaining
      </p>
    </>
  );
}

function TasksTileBody({ data }: { data: TaskCountsTilePayload }): React.JSX.Element {
  return (
    <p>
      {data.ready} ready · {data.blocked} blocked · {data.done} done
    </p>
  );
}

function BlockersTileBody({ data }: { data: BlockersTilePayload }): React.JSX.Element {
  return (
    <ul>
      {data.items.map((item) => (
        <li key={item.task_id}>
          {item.task_id}: {item.reason}
        </li>
      ))}
    </ul>
  );
}

function RibbonTileBody({ data }: { data: RibbonTilePayload }): React.JSX.Element {
  return (
    <ul>
      {data.runs.map((run) => (
        <li key={run.run_id}>
          <a href={run.repo_url ?? "#"}>{run.commit_sha}</a> {run.branch}
        </li>
      ))}
    </ul>
  );
}

/** BE-V1-TASK-019 (FR-013): six independently-fetched tiles (AC-1) --
 * each `useTile` call is its own fetch/error/retry, and `<Tile>` owns a
 * native error boundary on top, so one tile's outage can never blank the
 * page (AC-2, the core AC). "Open Kanban" is a forward-reference nav
 * link to TASK-017's board (unbuilt on main; not a dependency of this
 * task -- the href, not a missing symbol).
 */
function DashboardNav({ projectId }: { projectId: string }): React.JSX.Element {
  return (
    <div className="flex gap-[var(--space-4)] text-[length:var(--text-caption)]">
      <Link href={`/build/projects/${encodeURIComponent(projectId)}/settings`} className="underline">
        Project settings
      </Link>
      <Link href={`/build/projects/${encodeURIComponent(projectId)}/kanban`} className="underline">
        Open Kanban
      </Link>
    </div>
  );
}

/** One `useTile` call per tile keeps each fetch/error/retry cycle
 * independent (AC-1/AC-2) -- extracting this into a hook would hide that
 * isolation behind one call site, which is the opposite of the intent.
 */
function useDashboardTiles(projectId: string) {
  return {
    demo: useTile<DemoTilePayload>(projectId, "demo"),
    budget: useTile<BudgetTilePayload>(projectId, "budget"),
    forecast: useTile<ForecastTilePayload>(projectId, "forecast"),
    tasks: useTile<TaskCountsTilePayload>(projectId, "tasks"),
    blockers: useTile<BlockersTilePayload>(projectId, "blockers"),
    ribbon: useTile<RibbonTilePayload>(projectId, "ribbon"),
  };
}

function DashboardTiles({ tiles }: { tiles: ReturnType<typeof useDashboardTiles> }): React.JSX.Element {
  const { demo, budget, forecast, tasks, blockers, ribbon } = tiles;
  return (
    <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2 lg:grid-cols-3">
      <Tile title="Demo readiness" loading={demo.loading} error={demo.error} retry={demo.retry}>
        {demo.data && <DemoTileBody data={demo.data} />}
      </Tile>
      <Tile title="Budget" loading={budget.loading} error={budget.error} retry={budget.retry}>
        {budget.data && <BudgetTileBody data={budget.data} />}
      </Tile>
      <Tile title="Forecast" loading={forecast.loading} error={forecast.error} retry={forecast.retry}>
        {forecast.data && <ForecastTileBody data={forecast.data} />}
      </Tile>
      <Tile title="Tasks in flight" loading={tasks.loading} error={tasks.error} retry={tasks.retry}>
        {tasks.data && <TasksTileBody data={tasks.data} />}
      </Tile>
      <Tile title="Blockers" loading={blockers.loading} error={blockers.error} retry={blockers.retry}>
        {blockers.data && <BlockersTileBody data={blockers.data} />}
      </Tile>
      <Tile title="Git ribbon" loading={ribbon.loading} error={ribbon.error} retry={ribbon.retry}>
        {ribbon.data && <RibbonTileBody data={ribbon.data} />}
      </Tile>
    </div>
  );
}

export function ProjectDashboard({
  projectId,
  selfImprovementItems = [],
}: {
  projectId: string;
  selfImprovementItems?: SelfImprovementItem[];
}): React.JSX.Element {
  const tiles = useDashboardTiles(projectId);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <DashboardNav projectId={projectId} />
      <DashboardTiles tiles={tiles} />
      <SelfImprovementCard items={selfImprovementItems} />
    </div>
  );
}
