import { describe, expect, it } from "vitest";

import { provisionTenant, STUB_TENANTS, suspendTenant, summarizeTenants } from "./tenants";

describe("STUB_TENANTS", () => {
  it("seeds the three companies from refit-mock.html #screen-operator", () => {
    expect(STUB_TENANTS.map((t) => t.name)).toEqual([
      "Hammerbarn",
      "Acme Industrial",
      "Northwind Logistics",
    ]);
  });

  it("marks Northwind Logistics as onboarding and the rest active", () => {
    expect(STUB_TENANTS.find((t) => t.name === "Northwind Logistics")?.status).toBe("onboarding");
    expect(STUB_TENANTS.find((t) => t.name === "Hammerbarn")?.status).toBe("active");
  });
});

describe("summarizeTenants", () => {
  it("sums companies, members across tenants, and audit chains valid", () => {
    expect(summarizeTenants(STUB_TENANTS)).toEqual({
      companies: 3,
      membersAcrossTenants: 27,
      auditChainsValid: "3/3",
    });
  });
});

describe("provisionTenant", () => {
  it("appends a new onboarding tenant without mutating the input array", () => {
    const next = provisionTenant(STUB_TENANTS, "New Co");
    expect(next).toHaveLength(4);
    expect(STUB_TENANTS).toHaveLength(3);
    const created = next.at(-1)!;
    expect(created.name).toBe("New Co");
    expect(created.status).toBe("onboarding");
    expect(created.members).toBe(0);
    expect(created.entities).toBe(0);
  });
});

describe("suspendTenant", () => {
  it("flips the matching tenant to suspended without mutating the input array", () => {
    const first = STUB_TENANTS[0]!;
    const next = suspendTenant(STUB_TENANTS, first.id);
    expect(next[0]!.status).toBe("suspended");
    expect(first.status).toBe("active");
  });

  it("leaves other tenants untouched", () => {
    const next = suspendTenant(STUB_TENANTS, STUB_TENANTS[0]!.id);
    expect(next[1]!.status).toBe(STUB_TENANTS[1]!.status);
  });
});
