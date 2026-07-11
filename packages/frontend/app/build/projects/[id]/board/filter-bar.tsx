import { Button } from "@/components/ui/button";

import { BOARD_FILTERS, type BoardFilter } from "./filters";

/** FR-017: the five fixed filter buttons, URL-state driven by the caller. */
export function FilterBar({
  active,
  onChange,
}: {
  active: BoardFilter;
  onChange: (filter: BoardFilter) => void;
}): React.JSX.Element {
  return (
    <div role="group" aria-label="Board filters" className="flex flex-wrap gap-[var(--space-2)]">
      {BOARD_FILTERS.map((filter) => (
        <Button
          key={filter}
          variant={filter === active ? "primary" : "secondary"}
          onClick={() => onChange(filter)}
          aria-pressed={filter === active}
        >
          {filter}
        </Button>
      ))}
    </div>
  );
}
