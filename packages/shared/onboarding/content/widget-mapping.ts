import { WidgetMappingSchema, type WidgetMapping } from "./schema";

/**
 * Role -> starter-widget set (E3-S2 / FR-015, verbatim per AC-014-02):
 *   Business    -> ontology health + graph completeness (CE-METRICS-1, graceful-omit until CE M2)
 *   Technical   -> token spend + active projects + agent activity
 *   Compliance  -> compliance status + audit feed + self-improvement findings
 *   Admin       -> RBAC coverage + connector health + onboarding progress
 *
 * Every entry carries an engine-availability tag (AC-014-04) rather than being omitted when its
 * backing feature is not GA at M1 -- Platform E1-S6 filters by tag (AC-014-03).
 */
const raw: WidgetMapping = {
  business: [
    { widgetId: "ontology-health", engine: "constitution", availability: "m2" },
    { widgetId: "graph-completeness", engine: "constitution", availability: "m2" },
  ],
  technical: [
    { widgetId: "token-spend", engine: "platform", availability: "shipped" },
    { widgetId: "active-projects", engine: "build", availability: "post-v1" },
    { widgetId: "agent-activity", engine: "platform", availability: "shipped" },
  ],
  compliance: [
    { widgetId: "compliance-status", engine: "constitution", availability: "m2" },
    { widgetId: "audit-feed", engine: "platform", availability: "shipped" },
    { widgetId: "self-improvement-findings", engine: "build", availability: "post-v1" },
  ],
  admin: [
    { widgetId: "rbac-coverage", engine: "platform", availability: "shipped" },
    { widgetId: "connector-health", engine: "platform", availability: "post-v1" },
    { widgetId: "onboarding-progress", engine: "constitution", availability: "m2" },
  ],
};

export const WIDGET_MAPPING: WidgetMapping = WidgetMappingSchema.parse(raw);
