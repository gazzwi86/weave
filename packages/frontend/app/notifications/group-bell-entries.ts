/** Client-side presentation transform over `GET /api/notifications`
 * (TASK-007, `PLAT-NOTIFY-1`) -- no backend change. AC-5's resolved MCQ:
 * `model.version.published` notifications for the same recipient, arriving
 * within one browser session (tab lifetime), collapse into one bell row
 * summarising the version range.
 *
 * # ponytail: "session" = tab lifetime (in-memory sessionStartedAt), not a
 * server-tracked session concept -- upgrade to a rolling window only if
 * product asks for cross-tab batching.
 */

export interface BellNotification {
  id: string;
  event_type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
  target_iri?: string;
}

export interface GroupedBellEntry extends BellNotification {
  /** Present only on a collapsed model.version.published row. */
  summary?: string;
  batchedCount?: number;
}

const VERSION_PUBLISHED = "model.version.published";

function semverOf(entry: BellNotification): string | undefined {
  const value = entry.payload.semver;
  return typeof value === "string" ? value : undefined;
}

function flushVersionBuffer(buffer: BellNotification[], grouped: GroupedBellEntry[]): void {
  const [first, ...rest] = buffer;
  if (!first) return;
  if (rest.length === 0) {
    grouped.push(first);
  } else {
    const last = rest[rest.length - 1] ?? first;
    grouped.push({
      ...last,
      summary: `${semverOf(first) ?? "?"} → ${semverOf(last) ?? "?"} published`,
      batchedCount: buffer.length,
    });
  }
  buffer.length = 0;
}

/** Groups consecutive same-session `model.version.published` notifications
 * into one summary row; everything else (and publishes from before this
 * session started) passes through unchanged. Returns newest-first. */
export function groupBellEntries(
  notifications: BellNotification[],
  sessionStartedAt: string,
): GroupedBellEntry[] {
  if (notifications.length === 0) return [];

  const sorted = [...notifications].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const grouped: GroupedBellEntry[] = [];
  const versionBuffer: BellNotification[] = [];
  const sessionStart = new Date(sessionStartedAt).getTime();

  for (const entry of sorted) {
    if (entry.event_type !== VERSION_PUBLISHED) {
      flushVersionBuffer(versionBuffer, grouped);
      grouped.push(entry);
      continue;
    }
    if (new Date(entry.created_at).getTime() < sessionStart) {
      grouped.push(entry);
      continue;
    }
    versionBuffer.push(entry);
  }
  flushVersionBuffer(versionBuffer, grouped);

  return grouped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
