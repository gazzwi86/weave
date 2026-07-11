import type { WidgetStreamEvent } from "@/components/dashboard/types";

const EVENT_NAMES = new Set(["spec", "data", "done", "error"]);

/** Splits `event:`/`data:` blocks (separated by a blank line) out of a text
 * chunk, tolerating a block cut mid-stream by TCP framing -- the incomplete
 * tail is returned as `remainder` and re-prepended on the next call.
 * Implementation Hints: "~20-line splitter, no SSE library."
 */
export function parseSseEvents(
  chunk: string,
  buffered: string
): { events: WidgetStreamEvent[]; remainder: string } {
  const text = buffered + chunk;
  const blocks = text.split("\n\n");
  const remainder = blocks.pop() ?? "";

  const events: WidgetStreamEvent[] = [];
  for (const block of blocks) {
    const eventLine = block.split("\n").find((line) => line.startsWith("event: "));
    const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
    const eventName = eventLine?.slice("event: ".length);
    if (!eventName || !dataLine || !EVENT_NAMES.has(eventName)) continue;
    events.push({
      event: eventName as WidgetStreamEvent["event"],
      data: JSON.parse(dataLine.slice("data: ".length)),
    } as WidgetStreamEvent);
  }
  return { events, remainder };
}
