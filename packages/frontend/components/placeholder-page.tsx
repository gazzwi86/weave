import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TAG_LABEL, type SurfaceTag } from "@/components/shell/nav-items";

export interface PlaceholderPageProps {
  title: string;
  tag: SurfaceTag;
  description: string;
}

/** Phase-labelled surface (IA §8): a reachable page that states when the
 * real capability ships, so the nav communicates the product shape without
 * dead ends. */
export function PlaceholderPage({ title, tag, description }: PlaceholderPageProps) {
  const phaseLine =
    tag === "m1" ? "Being built in this pass (M1)." : `Delivered in phase ${TAG_LABEL[tag]}.`;

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {title}
        </h1>
        <Badge variant={tag === "m1" ? "info" : "neutral"}>{TAG_LABEL[tag]}</Badge>
      </div>
      <Card>
        <CardContent className="flex flex-col gap-[var(--space-2)]">
          <p className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {phaseLine}
          </p>
          <p className="text-[var(--color-text-muted)]">{description}</p>
        </CardContent>
      </Card>
    </main>
  );
}
