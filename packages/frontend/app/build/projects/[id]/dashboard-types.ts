/** BE-V1-TASK-019: wire-shape mirrors of `schemas/dashboard.py`'s six tile
 * DTOs. One type per tile, matching the backend's "no aggregate
 * mega-endpoint" design decision (AC-1/AC-2).
 */

export interface DemoTilePayload {
  output_location_ref: string | null;
  last_run_status: "passed" | "failed" | null;
}

export interface ForecastInputs {
  basis: string;
  mean_actual: number;
  completed_count: number;
  remaining_count: number;
  calibration: number;
}

export interface BudgetTilePayload {
  label: "estimated";
  total_estimate_usd: number;
  cap_usd: number | null;
  level: string | null;
}

export interface ForecastTilePayload {
  label: "estimated";
  forecast_usd: number;
  forecast_inputs: ForecastInputs;
}

export interface TaskCountsTilePayload {
  ready: number;
  blocked: number;
  done: number;
  revision: number;
}

export interface BlockerItem {
  task_id: string;
  reason: string;
}

export interface BlockersTilePayload {
  items: BlockerItem[];
}

export interface RibbonRun {
  run_id: string;
  branch: string;
  commit_sha: string;
  created_at: string;
  repo_url: string | null;
}

export interface RibbonTilePayload {
  runs: RibbonRun[];
}

/** AC-6: Build never owns the proposal lifecycle -- this is a link-out
 * shape only, sourced from the Platform feed once BE-SELFIMPROVE-1 ships.
 */
export interface SelfImprovementItem {
  id: string;
  title: string;
  href: string;
}
