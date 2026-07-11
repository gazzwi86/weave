import { describe, expect, it } from "vitest";

import { ROLE_PATHS, ROLE_PATH_LABELS } from "../onboarding/role-paths";
import type { RolePath } from "../onboarding/types";

describe("ROLE_PATH_LABELS (AC-006-01/04)", () => {
  it("has exactly one label for each of the 4 onboarding paths", () => {
    expect(ROLE_PATHS).toEqual(["business", "technical", "compliance", "admin"]);
    expect(Object.keys(ROLE_PATH_LABELS).sort()).toEqual([...ROLE_PATHS].sort());
  });

  it("every label is a non-empty human-readable string", () => {
    for (const path of ROLE_PATHS) {
      const label: string = ROLE_PATH_LABELS[path as RolePath];
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
