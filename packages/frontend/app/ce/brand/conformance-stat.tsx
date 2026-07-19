import { StatCard } from "@/components/ui/stat-card";

/** "Brand conformance, last 30 days" KPI -- G14 (remediation-2-api-gaps.md):
 * no aggregation endpoint exists yet (the source events, `gate_result_brand`
 * audit rows, are already emitted; nothing rolls them up into a pass rate).
 * Renders an honest pending state rather than a fabricated number -- swap
 * for a real fetch once G14 lands.
 */
export function ConformanceStat() {
  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <StatCard value="—" label="Brand conformance (30d)" tone="neutral" />
      <p className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
        Not yet available.
      </p>
    </div>
  );
}
