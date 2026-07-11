import { Badge } from "@/components/ui/badge";

import type { Severity } from "./types";

const VARIANT_BY_SEVERITY: Record<Severity, "danger" | "warn" | "info" | "neutral"> = {
  Violation: "danger",
  Warning: "warn",
  Info: "info",
  Unknown: "neutral",
};

/** Severity always carries its text label alongside colour (WCAG 1.4.1,
 * design system law) -- colour is never the sole signal. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge variant={VARIANT_BY_SEVERITY[severity]}>{severity}</Badge>;
}
