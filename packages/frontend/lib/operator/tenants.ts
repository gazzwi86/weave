/** Operator-console tenant data.
 *
 * refit-mock.html `#screen-operator` shows a real cross-tenant list, but the
 * backend ships no operator/tenant endpoints yet (list/provision/suspend --
 * tracked as gap G15, docs/design/remediation-2-api-gaps.md). This is a
 * documented static stub so the UI can be built and tested against the mock
 * today; swap the seed + these three pure functions for real
 * CE-OPERATOR-1-style fetches once G15 lands. No page/component imports
 * `fetch` here -- this stays a pure, UI-agnostic data module.
 */

export type TenantStatus = "active" | "onboarding" | "suspended";

export interface Tenant {
  id: string;
  name: string;
  monogram: string;
  industry: string;
  region: string;
  members: number;
  entities: number;
  modelVersion: string;
  status: TenantStatus;
  createdAt: string;
}

export const STUB_TENANTS: Tenant[] = [
  {
    id: "tenant-hammerbarn",
    name: "Hammerbarn",
    monogram: "H",
    industry: "retail",
    region: "ap-southeast-2",
    members: 14,
    entities: 1240,
    modelVersion: "v14",
    status: "active",
    createdAt: "2026-05-02",
  },
  {
    id: "tenant-acme-industrial",
    name: "Acme Industrial",
    monogram: "A",
    industry: "manufacturing",
    region: "ap-southeast-2",
    members: 9,
    entities: 612,
    modelVersion: "v6",
    status: "active",
    createdAt: "2026-06-11",
  },
  {
    id: "tenant-northwind-logistics",
    name: "Northwind Logistics",
    monogram: "N",
    industry: "logistics",
    region: "ap-southeast-4",
    members: 4,
    entities: 88,
    modelVersion: "v1",
    status: "onboarding",
    createdAt: "2026-07-15",
  },
];

export interface TenantSummary {
  companies: number;
  membersAcrossTenants: number;
  auditChainsValid: string;
}

// ponytail: "audit chains valid" is a static "N/N" (every seeded tenant is
// clean) since there's no real per-tenant audit-chain check to call yet --
// upgrade once G15's list endpoint carries a real verification result.
export function summarizeTenants(tenants: Tenant[]): TenantSummary {
  const companies = tenants.length;
  const membersAcrossTenants = tenants.reduce((sum, t) => sum + t.members, 0);
  return { companies, membersAcrossTenants, auditChainsValid: `${companies}/${companies}` };
}

export function provisionTenant(tenants: Tenant[], name: string): Tenant[] {
  const created: Tenant = {
    id: `tenant-${crypto.randomUUID()}`,
    name,
    monogram: name.charAt(0).toUpperCase(),
    industry: "unassigned",
    region: "unassigned",
    members: 0,
    entities: 0,
    modelVersion: "v0",
    status: "onboarding",
    createdAt: new Date().toISOString().slice(0, 10),
  };
  return [...tenants, created];
}

export function suspendTenant(tenants: Tenant[], id: string): Tenant[] {
  return tenants.map((t) => (t.id === id ? { ...t, status: "suspended" as const } : t));
}
