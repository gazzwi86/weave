import { describe, expect, it } from "vitest";

import { t } from "../i18n";

describe("t (AC-007-07)", () => {
  it("resolves a known onboarding key to its catalogue string", () => {
    expect(t("onboarding.tour.ce-overview.step1.title")).toBe("Welcome to the graph");
  });

  it("falls back to the key itself for an unknown key rather than throwing", () => {
    expect(t("onboarding.does.not.exist")).toBe("onboarding.does.not.exist");
  });
});
