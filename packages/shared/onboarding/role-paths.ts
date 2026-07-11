/** ONB-TASK-006: display labels for the 4 onboarding paths (AC-006-01/04).
 * Resolution itself happens backend-side (`GET /api/onboarding/path`) --
 * this table only lets the SPA label a resolved path without a round-trip.
 */
import type { RolePath } from "./types";

export const ROLE_PATHS = ["business", "technical", "compliance", "admin"] as const satisfies readonly RolePath[];

export const ROLE_PATH_LABELS: Record<RolePath, string> = {
  business: "Business",
  technical: "Technical",
  compliance: "Compliance",
  admin: "Admin",
};
