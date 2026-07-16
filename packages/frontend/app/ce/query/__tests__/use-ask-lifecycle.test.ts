import { describe, expect, it } from "vitest";

import { classifyFailureStatus, DEFAULT_TIMEOUT_MS } from "../use-ask-lifecycle";

// R2 regression guard: backend's OLLAMA_TIMEOUT_S is configured to 300s here --
// client timeout must stay above it or generations get killed and misreported
// as "timed out" before the backend actually gives up.
describe("DEFAULT_TIMEOUT_MS", () => {
  it("stays comfortably above the backend's 300s Ollama budget", () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(300000);
  });
});

// CE-V1-TASK-032 AC-2 unit test: `should_classify_503_as_provider_missing_not_generic_error`.
describe("classifyFailureStatus", () => {
  it("should_classify_503_as_provider_missing_not_generic_error", () => {
    expect(classifyFailureStatus(503)).toBe("provider-missing");
  });

  it("classifies a 502 (proxy upstream_unavailable) as provider-missing too", () => {
    expect(classifyFailureStatus(502)).toBe("provider-missing");
  });

  it("classifies a 400 translation failure as the generic error state", () => {
    expect(classifyFailureStatus(400)).toBe("error");
  });
});
