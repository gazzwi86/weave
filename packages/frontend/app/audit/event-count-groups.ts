/** refit-mock.html Security/Governance/Budget/Reliability health row --
 * event_type mapping confirmed against literal strings in
 * `packages/backend/src/weave_backend` (grep, not guessed). `PLAT-AUDIT-1`
 * has no fixed event_type enum (contracts.md), so a metric can list more
 * than one literal -- "Access denied" is served by both the legacy
 * `authz_denied` literal (rbac.py, dashboard.py) and the newer dotted
 * `access.rbac.denied` (metrics.py, validate.py, operations.py, ontology.py,
 * brand.py).
 *
 * "Policies changed" has `eventTypes: null` -- no event_type in the backend
 * carries it (deriving it from `operations.applied`'s `kind_counts.Policy`
 * would double as new backend-shaped aggregation logic and the `edges`
 * bucket conflates every edge type, not just `governedBy`). Per TASK A3's
 * scope guard this one metric stays pending; see the task's progress
 * summary for the full reasoning. */
export interface EventCountMetric {
  label: string;
  eventTypes: string[] | null;
}

export interface EventCountGroup {
  name: string;
  metrics: EventCountMetric[];
}

export const EVENT_COUNT_GROUPS: EventCountGroup[] = [
  {
    name: "Security",
    metrics: [
      { label: "Access denied", eventTypes: ["access.rbac.denied", "authz_denied"] },
      { label: "Cross-tenant rejected", eventTypes: ["security.cross_tenant.rejected"] },
    ],
  },
  {
    name: "Governance",
    metrics: [
      { label: "Rules committed", eventTypes: ["governance.shape_committed"] },
      { label: "Standards updated", eventTypes: ["standard_upserted"] },
      { label: "Policies changed", eventTypes: null },
    ],
  },
  {
    name: "Budget",
    metrics: [
      { label: "Cap changes", eventTypes: ["billing.cap.changed"] },
      { label: "Budget breaches", eventTypes: ["build.budget.breach"] },
    ],
  },
  {
    name: "Reliability",
    metrics: [
      { label: "Audit outages", eventTypes: ["audit_outage"] },
      { label: "Failed write-backs", eventTypes: ["write_back_fail_shacl"] },
    ],
  },
];
