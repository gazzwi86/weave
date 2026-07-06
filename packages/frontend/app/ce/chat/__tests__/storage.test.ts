import { beforeEach, describe, expect, it } from "vitest";

import type { ChatMessage } from "../types";
import { loadHistory, saveHistory } from "../storage";

// TASK-006 AC-006-05: conversation history survives a page reload via
// in-browser (localStorage) persistence -- server-side history is Phase 2.
describe("chat history localStorage persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty history when nothing has been saved yet", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("round-trips saved messages", () => {
    const messages: ChatMessage[] = [{ id: "1", role: "user", text: "hello" }];

    saveHistory(messages);

    expect(loadHistory()).toEqual(messages);
  });

  it("falls back to an empty history on corrupt stored JSON", () => {
    window.localStorage.setItem("weave:ce:chat:v1", "{not json");

    expect(loadHistory()).toEqual([]);
  });
});
