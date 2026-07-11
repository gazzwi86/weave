import { describe, expect, it } from "vitest";

import { parseSseEvents } from "../parse-sse-events";

describe("parseSseEvents", () => {
  it("parses one complete event block", () => {
    const { events, remainder } = parseSseEvents('event: spec\ndata: {"a":1}\n\n', "");
    expect(events).toEqual([{ event: "spec", data: { a: 1 } }]);
    expect(remainder).toBe("");
  });

  it("parses multiple events arriving in one chunk", () => {
    const chunk =
      'event: spec\ndata: {"a":1}\n\n' + 'event: data\ndata: {"rows":[1],"partial":true}\n\n';
    const { events, remainder } = parseSseEvents(chunk, "");
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ event: "spec", data: { a: 1 } });
    expect(events[1]).toEqual({ event: "data", data: { rows: [1], partial: true } });
    expect(remainder).toBe("");
  });

  it("holds back a partial event split across chunks, then completes it", () => {
    const first = parseSseEvents('event: spec\ndata: {"a":1', "");
    expect(first.events).toEqual([]);
    expect(first.remainder).toBe('event: spec\ndata: {"a":1');

    const second = parseSseEvents('}\n\n', first.remainder);
    expect(second.events).toEqual([{ event: "spec", data: { a: 1 } }]);
    expect(second.remainder).toBe("");
  });

  it("ignores a block missing an event: line", () => {
    const { events } = parseSseEvents('data: {"a":1}\n\n', "");
    expect(events).toEqual([]);
  });
});
