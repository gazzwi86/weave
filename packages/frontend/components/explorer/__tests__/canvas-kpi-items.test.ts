import { describe, expect, it } from "vitest";

import { canvasKpiItems } from "../canvas-kpi-items";
import type { VersionEntry } from "@/lib/explorer/versions/types";

describe("canvasKpiItems", () => {
  // CE-METRICS-1 (entity/relation counts, SHACL violation counts) is an
  // M2-only contract -- M1 has no aggregate producer for these. The canvas's
  // own render count is capped/filtered/expansion-dependent (MAX_VISIBLE_NODES),
  // not the true aggregate, so it's never substituted in. A literal "0" for
  // violations would read as false health -- "Pending" is the honest state.
  it("renders entities/relations/violations as Pending -- there is no M1 aggregate source", () => {
    const items = canvasKpiItems([]);
    expect(items.find((item) => item.label === "entities")?.value).toBe("Pending");
    expect(items.find((item) => item.label === "relations")?.value).toBe("Pending");
    expect(items.find((item) => item.label === "violations")?.value).toBe("Pending");
  });

  it("renders the published tile as Pending before the versions list has loaded", () => {
    const items = canvasKpiItems([]);
    expect(items.find((item) => item.label === "published")?.value).toBe("Pending");
  });

  it("renders the published tile as the latest version's real semver once loaded", () => {
    const versions: VersionEntry[] = [
      { version_iri: "urn:v13", semver: "13", published_at: "2026-01-01", is_latest: false },
      { version_iri: "urn:v14", semver: "14", published_at: "2026-02-01", is_latest: true },
    ];
    expect(canvasKpiItems(versions).find((item) => item.label === "published")?.value).toBe("14");
  });
});
