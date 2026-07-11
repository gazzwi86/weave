import { describe, expect, it } from "vitest";

import { canSuppressNotificationType } from "../can-suppress";

describe("canSuppressNotificationType", () => {
  it("rejects a suppress control for audit.chain.invalid when role is workspace_admin", () => {
    expect(canSuppressNotificationType("audit.chain.invalid", "workspace_admin")).toBe(false);
  });

  it("rejects a suppress control for audit.chain.invalid when role is compliance_officer", () => {
    expect(canSuppressNotificationType("audit.chain.invalid", "compliance_officer")).toBe(false);
  });

  it("allows a suppress control for audit.chain.invalid for any other role", () => {
    expect(canSuppressNotificationType("audit.chain.invalid", "author")).toBe(true);
    expect(canSuppressNotificationType("audit.chain.invalid", null)).toBe(true);
  });

  it("allows a suppress control for other notification types regardless of role", () => {
    expect(canSuppressNotificationType("job.completed", "workspace_admin")).toBe(true);
  });
});
