import { describe, expect, it } from "vitest";

import { formatKpiValue } from "../format-kpi-value";

describe("formatKpiValue", () => {
  it("H2: shortens a Weave URN with a :vX.Y.Z tail to just the version", () => {
    const urn = "urn:weave:tenant:acme-corp:ws:2b00d676-1234-4a1b-9c3d-abcdef012345:v0.1.6";

    expect(formatKpiValue(urn)).toEqual({ display: "v0.1.6", title: urn });
  });

  it("leaves a plain string untouched (no :vX.Y.Z tail)", () => {
    expect(formatKpiValue("Entities in model")).toEqual({
      display: "Entities in model",
      title: undefined,
    });
  });

  it("leaves a non-urn: string with a version-shaped tail untouched", () => {
    const value = "release-notes:v0.1.6";

    expect(formatKpiValue(value)).toEqual({ display: value, title: undefined });
  });

  it("passes a number through untouched", () => {
    expect(formatKpiValue(42)).toEqual({ display: "42", title: undefined });
  });
});
