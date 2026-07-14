import { describe, expect, it } from "vitest";

import { classifyFailureStatus } from "../use-ask-lifecycle";

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
