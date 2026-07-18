import { describe, expect, it } from "vitest";

import { canvasKpiItems } from "../canvas-kpi-items";
import type { CytoscapeElement } from "@/lib/explorer/types";
import type { VersionEntry } from "@/lib/explorer/versions/types";

const NODE = (id: string): CytoscapeElement => ({ data: { id } });
const EDGE = (id: string, source: string, target: string): CytoscapeElement => ({ data: { id, source, target } });

describe("canvasKpiItems", () => {
  // CE-METRICS-1 (entity/relation counts, SHACL violation counts) is an
  // M2-only contract -- M1 has no aggregate producer for these. Violations
  // has no client-side SHACL data either way, so it stays "Pending". A
  // literal "0" there would read as false health.
  it("renders entities/relations/violations as Pending when no elements are loaded", () => {
    const items = canvasKpiItems([], null);
    expect(items.find((item) => item.label === "entities")?.value).toBe("Pending");
    expect(items.find((item) => item.label === "relations")?.value).toBe("Pending");
    expect(items.find((item) => item.label === "violations")?.value).toBe("Pending");
  });

  // Not the true CE-METRICS-1 aggregate -- the canvas's own loaded-element
  // count, which is capped/filtered/expansion-dependent (MAX_VISIBLE_NODES).
  // Real enough to replace "Pending" for entities/relations; violations
  // still has no client-side source, so it's untouched.
  it("renders entities/relations from the canvas's loaded elements, violations still Pending", () => {
    const elements = [NODE("a"), NODE("b"), EDGE("e1", "a", "b")];
    const items = canvasKpiItems([], elements);
    expect(items.find((item) => item.label === "entities")?.value).toBe("2");
    expect(items.find((item) => item.label === "relations")?.value).toBe("1");
    expect(items.find((item) => item.label === "violations")?.value).toBe("Pending");
  });

  it("renders the published tile as Pending before the versions list has loaded", () => {
    const items = canvasKpiItems([], null);
    expect(items.find((item) => item.label === "published")?.value).toBe("Pending");
  });

  it("renders the published tile as the latest version's real semver once loaded", () => {
    const versions: VersionEntry[] = [
      { version_iri: "urn:v13", semver: "13", published_at: "2026-01-01", is_latest: false },
      { version_iri: "urn:v14", semver: "14", published_at: "2026-02-01", is_latest: true },
    ];
    expect(canvasKpiItems(versions, null).find((item) => item.label === "published")?.value).toBe("14");
  });
});
