import { describe, expect, it } from "vitest";

import { resolveHeaderScope } from "../header-scope";

// AC-8: binding tenancy ruling -- the header switcher never renders, for
// any role; workspace provisioning survives only inside Settings ->
// Workspaces, gated to the provisioning-capable role.
describe("resolveHeaderScope", () => {
  it("never shows the header switcher for a regular member", () => {
    expect(resolveHeaderScope("author")).toEqual({
      showHeaderSwitcher: false,
      showSettingsWorkspacesEntry: false,
    });
  });

  it("never shows the header switcher for an admin, but shows the Settings entry", () => {
    expect(resolveHeaderScope("admin")).toEqual({
      showHeaderSwitcher: false,
      showSettingsWorkspacesEntry: true,
    });
  });

  it("hides the Settings entry when role is unknown", () => {
    expect(resolveHeaderScope(null)).toEqual({
      showHeaderSwitcher: false,
      showSettingsWorkspacesEntry: false,
    });
  });
});
