import { describe, expect, it } from "vitest";

import { checkRateLimit } from "./rate-limit";

const WINDOW_MS = 60_000;
const LIMIT = 5;

describe("checkRateLimit", () => {
  it("allows requests up to the limit within the window", () => {
    const store = new Map<string, number[]>();
    let now = 0;

    for (let i = 0; i < LIMIT; i += 1) {
      expect(checkRateLimit(store, "client-a", now, LIMIT, WINDOW_MS)).toBe(true);
      now += 1000;
    }
  });

  it("blocks the request after the limit is reached within the window", () => {
    const store = new Map<string, number[]>();
    let now = 0;

    for (let i = 0; i < LIMIT; i += 1) {
      checkRateLimit(store, "client-a", now, LIMIT, WINDOW_MS);
      now += 100;
    }

    expect(checkRateLimit(store, "client-a", now, LIMIT, WINDOW_MS)).toBe(false);
  });

  it("allows requests again once the window has elapsed", () => {
    const store = new Map<string, number[]>();
    for (let i = 0; i < LIMIT; i += 1) {
      checkRateLimit(store, "client-a", i * 100, LIMIT, WINDOW_MS);
    }

    const afterWindow = WINDOW_MS + 1;
    expect(checkRateLimit(store, "client-a", afterWindow, LIMIT, WINDOW_MS)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const store = new Map<string, number[]>();
    for (let i = 0; i < LIMIT; i += 1) {
      checkRateLimit(store, "client-a", i * 100, LIMIT, WINDOW_MS);
    }

    expect(checkRateLimit(store, "client-b", 0, LIMIT, WINDOW_MS)).toBe(true);
  });
});
