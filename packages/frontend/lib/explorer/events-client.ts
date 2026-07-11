/** TASK-026 AC-7: CE-EVENT-1 beta seq feed -- the polled transport
 * (contracts.md: no bespoke "since-version" filter exists on CE-READ-1).
 * Draft-commit rows carry `version_iri: null`. */
export interface EventEntry {
  entity_iri: string;
  version_iri: string | null;
  seq: number;
}

export type EventsPollResult = { status: 200; events: EventEntry[]; latest_seq: number } | { status: 410 };

export async function fetchEvents(sinceSeq: number, limit = 200): Promise<EventsPollResult> {
  const res = await fetch(`/api/proxy/events?since_seq=${sinceSeq}&limit=${limit}`);
  if (res.status === 410) return { status: 410 };
  if (!res.ok) throw new Error(`events fetch failed: ${res.status}`);
  const body = (await res.json()) as { events: EventEntry[]; latest_seq: number };
  return { status: 200, events: body.events, latest_seq: body.latest_seq };
}
