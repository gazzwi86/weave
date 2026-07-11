import { cn } from "@/lib/utils";
import { KindChip, type BpmoKind } from "./KindChip";

export interface CanvasLegendEntry {
  kind: BpmoKind;
  label: string;
}

export interface CanvasLegendProps {
  entries: CanvasLegendEntry[];
  className?: string;
}

/** Kind-colour legend for the graph canvas -- flat list of `KindChip`s. */
export function CanvasLegend({ entries, className }: CanvasLegendProps) {
  return (
    <ul className={cn("flex flex-wrap gap-[var(--space-2)]", className)}>
      {entries.map((entry) => (
        <li key={entry.kind}>
          <KindChip kind={entry.kind} label={entry.label} />
        </li>
      ))}
    </ul>
  );
}
