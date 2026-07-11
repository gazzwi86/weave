import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import type { WidgetOut } from "@/components/dashboard/types";
import { PageHeaderSlot } from "@/components/templates/PageHeaderSlot";
import { auth } from "@/auth";

interface RoleHomeCapability {
  id: string;
  label: string;
  href: string | null;
  available: boolean;
  coming_soon: string | null;
}

interface RoleHomeNextAction {
  label: string;
  href: string;
}

interface CompletenessRow {
  kind: string;
  instance_count: number;
  coverage_gap_count: number;
}

interface RoleHomeResponse {
  capabilities: RoleHomeCapability[];
  summary: Record<string, unknown>;
  next_action: RoleHomeNextAction;
  completeness: CompletenessRow[];
  tiles: WidgetOut[];
}

/** AC-1..7: single server-side fetch of the composed role-home payload --
 * no client cache/SWR layer here, TASK-010's SWR path already lives
 * server-side on the `scope='role_home'` tile (m2-delta §7).
 */
async function fetchRoleHome(accessToken: string): Promise<RoleHomeResponse | null> {
  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  const response = await fetch(`${backendUrl}/api/role-home`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return response.ok ? ((await response.json()) as RoleHomeResponse) : null;
}

function CapabilityCard({ capability }: { capability: RoleHomeCapability }) {
  if (!capability.available) {
    return (
      <Card data-testid={`capability-${capability.id}`} className="opacity-70">
        <CardTitle>{capability.label}</CardTitle>
        <div className="mt-[var(--space-2)] flex items-center gap-[var(--space-2)]">
          <Badge variant="neutral">Coming soon</Badge>
          <span className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            {capability.coming_soon}
          </span>
        </div>
      </Card>
    );
  }

  return (
    <Card data-testid={`capability-${capability.id}`}>
      <Link
        href={capability.href ?? "#"}
        className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-accent-primary)] hover:underline"
      >
        {capability.label}
      </Link>
    </Card>
  );
}

/** AC-3: per-kind coverage table -- `compact` per the brief (Hints §4), a
 * plain table reusing `Card`, not a bespoke heatmap component.
 */
function CompletenessTable({ rows }: { rows: CompletenessRow[] }) {
  return (
    <Card>
      <CardTitle>Model completeness</CardTitle>
      <table className="mt-[var(--space-3)] w-full text-[length:var(--text-body-sm)]">
        <thead>
          <tr className="text-[var(--color-text-muted)]">
            <th className="text-left font-[var(--font-weight-medium)]">Kind</th>
            <th className="text-right font-[var(--font-weight-medium)]">Instances</th>
            <th className="text-right font-[var(--font-weight-medium)]">Gaps</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.kind} data-testid={`completeness-row-${row.kind}`}>
              <td className="text-[var(--color-text-default)]">{row.kind}</td>
              <td className="text-right text-[var(--color-text-default)]">{row.instance_count}</td>
              <td className="text-right text-[var(--color-text-default)]">{row.coverage_gap_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** "What can Weave do for me?" role-home landing (PLAT-V1-TASK-017,
 * EPIC-010). Protected page (middleware.ts). Composes one backend call --
 * capabilities, completeness map, next-action banner, and the role-home
 * SWR tiles (same `WidgetTile`/`Badge` stale indicator as the dashboard).
 */
export default async function RoleHomePage() {
  const session = await auth();
  const data = session?.accessToken ? await fetchRoleHome(session.accessToken) : null;

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-[var(--space-5)] px-[var(--space-5)] py-[var(--space-4)]">
      <PageHeaderSlot title="What can Weave do for you?" />

      {data ? (
        <>
          <Card data-testid="next-action-banner">
            <CardTitle>Recommended next step</CardTitle>
            <Link
              href={data.next_action.href}
              className="mt-[var(--space-2)] inline-block text-[length:var(--text-body)] text-[var(--color-accent-primary)] hover:underline"
            >
              {data.next_action.label}
            </Link>
          </Card>

          <div className="grid grid-cols-1 gap-[var(--space-4)] md:grid-cols-2">
            {data.capabilities.map((capability) => (
              <CapabilityCard key={capability.id} capability={capability} />
            ))}
          </div>

          <CompletenessTable rows={data.completeness} />

          <WidgetGrid widgets={data.tiles} />
        </>
      ) : (
        <p data-testid="role-home-error">Unable to load role-home data.</p>
      )}
    </main>
  );
}
