import { RelativeTime } from "@/components/molecules/RelativeTime";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

export interface ActivityEntry {
  seq: number;
  ts: string;
  engine: string;
  event_type: string;
  target_iri: string;
}

/** Engine → pill text tint (v5 mock eng-const/eng-build/eng-audit). No
 * -soft background tokens exist, so the engine colour rides the text on a
 * neutral chip; unknown engines fall back to muted. */
const ENGINE_TONE: Record<string, string> = {
  Constitution: "text-[var(--color-accent-primary)]",
  Build: "text-[var(--color-success)]",
  Audit: "text-[var(--color-warn)]",
};

/** "https://weave.io/instances/OrdersDB" -> "OrdersDB". */
function targetLabel(iri: string): string {
  return iri.split(/[:/#]/).filter(Boolean).at(-1) ?? iri;
}

/** Recent-activity feed (v5 Home): engine tag + a terse event summary +
 * relative time, over the tenant audit trail. ponytail: the summary is
 * `event_type · target`, not a per-event-type copy table (same known stub as
 * NotificationCenter's labelFor) — swap in real phrasing when product wants it. */
export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  return (
    <section
      aria-label="Recent activity"
      className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
    >
      <h2 className="mb-[var(--space-2)]">
        <Eyebrow as="span">Recent activity</Eyebrow>
      </h2>
      {entries.length === 0 ? (
        <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
          No recent activity yet.
        </p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li
              key={entry.seq}
              className="flex items-center gap-[var(--space-3)] border-b border-[var(--color-border)] py-[var(--space-2)] text-[length:var(--text-body-sm)] last:border-b-0"
            >
              <span
                className={cn(
                  "shrink-0 rounded-[var(--radius-sm)] bg-[var(--color-hover)] px-[var(--space-2)] py-[2px] text-[length:var(--text-caption)] font-[var(--font-weight-semibold)]",
                  ENGINE_TONE[entry.engine] ?? "text-[var(--color-text-muted)]"
                )}
              >
                {entry.engine}
              </span>
              <span className="flex-1 truncate text-[var(--color-text-muted)]">
                {entry.event_type} · <strong className="text-[var(--color-text-default)]">{targetLabel(entry.target_iri)}</strong>
              </span>
              <RelativeTime iso={entry.ts} className="shrink-0 text-[var(--color-text-subtle)]" />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
