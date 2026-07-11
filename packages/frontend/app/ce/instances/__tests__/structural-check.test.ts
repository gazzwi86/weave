import { describe, expect, it } from "vitest";

import { checkFieldStructural } from "../structural-check";
import type { PropertyShape } from "../../chat/types";

const REQUIRED_SHAPE: PropertyShape = {
  path: "https://weave.io/ontology/owner",
  name: "Owner",
  is_relationship: true,
  min_count: 1,
  max_count: 1,
  severity: "Violation",
};

const OPTIONAL_SHAPE: PropertyShape = { ...REQUIRED_SHAPE, min_count: null };

describe("checkFieldStructural", () => {
  it("should_flag_structural_violation_on_blur_without_network_call", () => {
    // no fetch stubbed at all -- a network call would throw/reject in this env
    expect(checkFieldStructural(REQUIRED_SHAPE, "")).toBe("Owner is required (min count 1).");
  });

  it("passes a required field once it has a value", () => {
    expect(checkFieldStructural(REQUIRED_SHAPE, "https://weave.io/instances/x")).toBeNull();
  });

  it("never flags an optional empty field", () => {
    expect(checkFieldStructural(OPTIONAL_SHAPE, "")).toBeNull();
  });
});
