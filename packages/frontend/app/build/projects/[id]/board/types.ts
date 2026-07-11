/** BE-V1-TASK-017: response shapes for `GET /api/projects/:id/board` and
 * `GET /api/projects/:id/task-tree` -- mirrors `schemas/board.py`.
 */

export const LANE_ORDER = ["Backlog", "Ready", "In Progress", "Review", "QA", "Done"] as const;
export type Lane = (typeof LANE_ORDER)[number];

export interface BoardCard {
  id: string;
  status: string;
  lane: Lane;
  failure_class: string | null;
  retry_attempt: number | null;
  retry_ceiling: number | null;
  hitl_escalated: boolean;
}

export interface BoardResponse {
  project_iri: string;
  lanes: Lane[];
  cards: BoardCard[];
}

export interface TaskTreeNode {
  id: string;
  status: string;
  blocked_by: string[];
  missing: boolean;
}

export interface TaskTreeResponse {
  project_iri: string;
  nodes: TaskTreeNode[];
}
