import { BarChart, type BarChartProps } from "@/components/molecules/BarChart";

/**
 * app/** import-boundary crossing (`weave/app-layer-boundary`) -- same
 * pass-through pattern as `EntityRefSlot`/`PageHeaderSlot`. AC-2/AC-3:
 * category comparisons render as `BarChart` bars, never a text-glyph delta,
 * without pages importing the molecule layer themselves.
 */
export function BarChartSlot(props: BarChartProps) {
  return <BarChart {...props} />;
}
