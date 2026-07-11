import { SeverityBadge } from "./severity-badge";
import type { RuleCoverage, ValidationResultEntry } from "./types";

interface RuleRowProps {
  rule: RuleCoverage;
  violatingEntities: ValidationResultEntry[];
}

/** One rule's catalogue row (AC-006-03/-05): shows even at zero violations,
 * and links each violating entity to its resource view (explorer's
 * established `?focus=<iri>` convention) so an auditor can jump straight
 * from a rule to the offending data. */
export function RuleRow({ rule, violatingEntities }: RuleRowProps) {
  return (
    <li className="flex flex-col gap-[var(--space-2)] border-b border-[var(--color-border)] py-[var(--space-3)] last:border-0">
      <div className="flex items-center gap-[var(--space-3)]">
        <SeverityBadge severity={rule.severity} />
        <span className="text-[length:var(--text-body)] font-[var(--font-weight-medium)] text-[var(--color-text-default)]">
          {rule.description}
        </span>
        <span className="ml-auto text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
          {rule.origin} · {rule.violation_count} violation{rule.violation_count === 1 ? "" : "s"}
        </span>
      </div>
      {violatingEntities.length > 0 && (
        <ul className="flex flex-wrap gap-[var(--space-2)] pl-[var(--space-6)]">
          {violatingEntities.map((entry) => (
            <li key={`${entry.focus_node}-${entry.path ?? ""}`}>
              <a
                href={`/explorer?focus=${encodeURIComponent(entry.focus_node)}`}
                className="text-[length:var(--text-caption)] text-[var(--color-info)] underline"
              >
                {entry.focus_node}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
