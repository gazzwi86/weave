import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export interface PlaceholderPageProps {
  title: string;
  description: string;
}

/** A reachable page for a not-yet-built surface. No milestone jargon
 * (feedback_no_phase_pills.md, 2026-07-17 ruling) -- always the same plain
 * "soon" pill, regardless of which internal milestone it's scheduled for. */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {title}
        </h1>
        <Badge variant="neutral">soon</Badge>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-[var(--space-2)]">
          <p className="text-[var(--color-text-muted)]">{description}</p>
        </CardContent>
      </Card>
    </main>
  );
}
