import { afterEach, describe, expect, it } from "vitest";

import { backendApiUrl } from "./backend-url";

const ORIGINAL = process.env.BACKEND_API_URL;

describe("backendApiUrl", () => {
  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.BACKEND_API_URL;
    } else {
      process.env.BACKEND_API_URL = ORIGINAL;
    }
  });

  it("normalizes a localhost hostname to 127.0.0.1", () => {
    process.env.BACKEND_API_URL = "http://localhost:8000";
    expect(backendApiUrl()).toBe("http://127.0.0.1:8000");
  });

  it("defaults to 127.0.0.1 when unset", () => {
    delete process.env.BACKEND_API_URL;
    expect(backendApiUrl()).toBe("http://127.0.0.1:8000");
  });

  it("leaves a non-localhost host untouched", () => {
    process.env.BACKEND_API_URL = "https://api.weave.internal:8443";
    expect(backendApiUrl()).toBe("https://api.weave.internal:8443");
  });
});
