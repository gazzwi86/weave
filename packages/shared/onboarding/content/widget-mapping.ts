import { WidgetMappingSchema, type WidgetMapping } from "./schema";

/** Role -> starter-widget set (E3-S2). CE-METRICS-1 is graceful-omitted until CE M2. */
const raw: WidgetMapping = {
  business: [
    { widgetId: "CE-METRICS-1", engine: "constitution", availability: "m2" },
    { widgetId: "CE-OVERVIEW-1", engine: "constitution", availability: "shipped" },
  ],
  technical: [
    { widgetId: "CE-QUERY-1", engine: "constitution", availability: "shipped" },
    { widgetId: "GE-CANVAS-1", engine: "graph-explorer", availability: "shipped" },
  ],
  compliance: [{ widgetId: "CE-RULES-1", engine: "constitution", availability: "shipped" }],
  admin: [{ widgetId: "CE-OVERVIEW-1", engine: "constitution", availability: "shipped" }],
};

export const WIDGET_MAPPING: WidgetMapping = WidgetMappingSchema.parse(raw);
