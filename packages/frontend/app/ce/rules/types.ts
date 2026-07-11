export type Severity = "Violation" | "Warning" | "Info" | "Unknown";
export type RuleOrigin = "framework" | "tenant";

/** CE-TASK-006's `GET /api/validate` per-violation entry. */
export interface ValidationResultEntry {
  shape_iri: string;
  focus_node: string;
  path: string | null;
  message: string;
  severity: Severity;
}

/** CE-TASK-006's per-rule catalogue entry -- included even with zero
 * violations (AC-006-03). Violating entities are derived client-side from
 * `results` (never eagerly paginated into this entry, task brief hint). */
export interface RuleCoverage {
  shape_iri: string;
  severity: Severity;
  description: string;
  origin: RuleOrigin;
  violation_count: number;
}

export interface ValidationReport {
  pending: false;
  results: ValidationResultEntry[];
  rules: RuleCoverage[];
  ran_at: string;
  version_resolved: string;
}

export interface ValidationPending {
  pending: true;
}

export type ValidateResponse = ValidationReport | ValidationPending;
