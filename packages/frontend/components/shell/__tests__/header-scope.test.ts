import { describe, expect, it } from "vitest";

import { resolveHeaderScope } from "../header-scope";

// AC-8: binding tenancy ruling retires the GENERAL header switcher -- it
// never renders for a regular member. V6 carves out the sanctioned
// exception: a super-admin (isPlatformOperator) sees a company switcher in
// the header (avatar flyout), because they alone operate across companies.
describe("resolveHeaderScope", () => {
  it("never shows the header switcher for a regular member", () => {
    expect(resolveHeaderScope("author")).toEqual({
      showHeaderSwitcher: false,
      showSettingsWorkspacesEntry: false,
    });
  });

  it("shows the super-admin company switcher and the Settings entry for an admin", () => {
    expect(resolveHeaderScope("admin")).toEqual({
      showHeaderSwitcher: true,
      showSettingsWorkspacesEntry: true,
    });
  });

  it("hides both entries when role is unknown", () => {
    expect(resolveHeaderScope(null)).toEqual({
      showHeaderSwitcher: false,
      showSettingsWorkspacesEntry: false,
    });
  });
});
