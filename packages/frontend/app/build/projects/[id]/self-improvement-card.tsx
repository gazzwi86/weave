import { Card, CardContent, CardTitle } from "@/components/ui/card";

import type { SelfImprovementItem } from "./dashboard-types";

/** AC-6: read-only, link-out only -- Build never owns the proposal
 * lifecycle (that's Platform's `BE-SELFIMPROVE-1`). Absent feed -> hidden,
 * not errored, so `items` defaults to `[]` at the call site until Platform
 * ships a real feed to fetch.
 * ponytail: no Platform client exists yet anywhere in this codebase, so
 * this stays presentational; wire in a real fetch once BE-SELFIMPROVE-1
 * ships (see contracts.md §4).
 */
export function SelfImprovementCard({
  items,
}: {
  items: SelfImprovementItem[];
}): React.JSX.Element | null {
  if (items.length === 0) return null;

  return (
    <Card data-testid="self-improvement-card">
      <CardTitle>Self-improvement</CardTitle>
      <CardContent>
        <ul className="flex flex-col gap-[var(--space-1)]">
          {items.map((item) => (
            <li key={item.id}>
              <a href={item.href} className="underline">
                {item.title}
              </a>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
