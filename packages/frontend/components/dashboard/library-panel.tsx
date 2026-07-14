import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import type { LibraryItemOut } from "./types";

export interface LibraryPanelProps {
  items: LibraryItemOut[];
  onAdd: (id: string) => void;
}

/** TASK-015 AC-4/AC-5/AC-6: read-only-until-added list of tenant-published
 * widgets -- "Add" creates the viewer's own independent copy (store.py's
 * `add_library_item`), never a shared reference to the published row.
 */
export function LibraryPanel({ items, onAdd }: LibraryPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className="w-full max-w-[1440px] px-[var(--space-5)] mt-[var(--space-6)]">
      <h2 className="text-[length:var(--text-h3)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)] mb-[var(--space-3)]">
        Widget library
      </h2>
      <div className="grid grid-cols-1 gap-[var(--space-4)] lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.id} data-testid={`library-item-${item.id}`}>
            <CardContent className="flex flex-col gap-[var(--space-2)]">
              <div className="flex items-center justify-between gap-[var(--space-2)]">
                <h3 className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
                  {item.name}
                </h3>
                {!item.source_available && <Badge variant="warn">Source unavailable</Badge>}
              </div>
              {item.description && (
                <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
                  {item.description}
                </p>
              )}
              <button
                type="button"
                aria-label={`Add ${item.name} to my dashboard`}
                onClick={() => onAdd(item.id)}
              >
                Add to my dashboard
              </button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
