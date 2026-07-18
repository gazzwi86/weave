import Link from "next/link";

import { ActivityFeed, type ActivityEntry } from "@/components/dashboard/activity-feed";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { ChecklistWidget } from "@/components/onboarding/checklist-widget";
import { ExplainBand } from "@/components/ui/explain-band";
import { GetGoing } from "@/components/dashboard/get-going";
import { NeedsYou } from "@/components/dashboard/needs-you";
import { PromptBarContainer } from "@/components/dashboard/prompt-bar-container";
import type { LibraryItemOut, WidgetOut } from "@/components/dashboard/types";
import { EntityRefSlot } from "@/components/templates/EntityRefSlot";
import { PageHeaderSlot } from "@/components/templates/PageHeaderSlot";
import { auth } from "@/auth";
import { backendApiUrl } from "@/lib/backend-url";

interface WhoamiResponse {
  sub: string;
  tenant_id: string;
  principal_iri: string;
}

const BENTO = [
  { heading: "Constitution", body: "The living knowledge graph of how your company operates.", href: "/ce", cta: "Explore the model →" },
  { heading: "Build", body: "Generate and run the apps, agents, and automations from your model.", href: "/build", cta: "Open Build →" },
  { heading: "Audit", body: "Every write, hash-chained and tamper-evident.", href: "/audit", cta: "View audit →" },
] as const;

/** ponytail: plain server-side fetch, no client cache/SWR layer -- add one
 * if this page grows more than the reads below.
 */
async function fetchWhoami(accessToken: string): Promise<WhoamiResponse | null> {
  const response = await fetch(`${backendApiUrl()}/api/whoami`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return response.ok ? ((await response.json()) as WhoamiResponse) : null;
}

/** AC-6: pure SWR read of the fixed default dashboard -- this endpoint
 * never calls CE-METRICS-1 itself (that only happens on a refresh action),
 * so this stays a plain server-side fetch, same shape as fetchWhoami.
 */
async function fetchDashboardWidgets(accessToken: string, scope: "tenant_default" | "user"): Promise<WidgetOut[]> {
  const response = await fetch(
    `${backendApiUrl()}/api/dashboard/widgets?scope=${scope}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  if (!response.ok) return [];
  const body = (await response.json()) as { widgets: WidgetOut[] };
  return body.widgets;
}

/** TASK-015 AC-4: initial tenant library list, server-rendered same as the
 * default widgets above -- client only re-fetches on publish/add mutations. */
async function fetchLibraryItems(accessToken: string): Promise<LibraryItemOut[]> {
  const response = await fetch(`${backendApiUrl()}/api/dashboard/library`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { items: LibraryItemOut[] };
  return body.items;
}

/** Recent-activity feed source: the newest tenant audit entries. Admin-only
 * upstream, so a non-admin (403) or any failure degrades to an empty feed --
 * same fail-soft posture as the widget/library reads. */
async function fetchRecentActivity(accessToken: string): Promise<ActivityEntry[]> {
  const response = await fetch(`${backendApiUrl()}/api/audit?page=1&per_page=6`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { entries: ActivityEntry[] };
  return body.entries ?? [];
}

/** v5 Home kind-tiles: Constitution's live count comes from the same
 * already-fetched `tenant_default` "Entities in model" widget the widget
 * grid below renders -- no new ontology/CE-METRICS fetch (AC-6). Build and
 * Audit have no equivalent seeded widget yet (`dashboard/default_tiles.py`
 * only ships Constitution-shaped tiles), so those two stay the static nav
 * card until a matching widget exists. */
function findEntityCount(widgets: WidgetOut[]): number | null {
  const widget = widgets.find((entry) => entry.spec.title === "Entities in model");
  return typeof widget?.last_result === "number" ? widget.last_result : null;
}

function BentoGrid({ entityCount }: { entityCount: number | null }) {
  return (
    <div className="grid gap-[var(--space-4)] md:grid-cols-3">
      {BENTO.map((tile) => (
        <Card key={tile.href}>
          <p className="text-[length:var(--text-overline)] uppercase tracking-[var(--text-overline-tracking)] text-[var(--color-text-subtle)]">
            {tile.heading}
          </p>
          <CardContent className="flex flex-col gap-[var(--space-3)]">
            {tile.heading === "Constitution" && entityCount !== null ? (
              <p className="text-[length:var(--text-h2)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
                {entityCount} entities
              </p>
            ) : null}
            <p className="text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">{tile.body}</p>
            <Link
              href={tile.href}
              className="text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:text-[var(--color-accent-hover)]"
            >
              {tile.cta}
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Protected page (middleware.ts enforces the redirect). Fetches
 * `/api/whoami` from the backend server-side to prove the session is
 * backed by a real, JWT-verified principal (Law B) -- not just a UI render.
 */
export default async function DashboardPage() {
  const session = await auth();
  const token = session?.accessToken;
  const principal = token ? await fetchWhoami(token) : null;
  const [defaultWidgets, userWidgets, libraryItems, activity] = token
    ? await Promise.all([
        fetchDashboardWidgets(token, "tenant_default"),
        fetchDashboardWidgets(token, "user"),
        fetchLibraryItems(token),
        fetchRecentActivity(token),
      ])
    : [[], [], [], []];
  const widgets = [...defaultWidgets, ...userWidgets];

  return (
    <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-[var(--space-5)] p-[var(--space-6)]">
      <div className="flex items-start justify-between gap-[var(--space-4)]">
        <div>
          <p className="text-[length:var(--text-overline)] font-[var(--font-weight-semibold)] uppercase tracking-[var(--text-overline-tracking)] text-[var(--color-accent-primary)]">
            Home
          </p>
          {/* AC-2: PageHeader organism -- --text-h1 title, no bespoke heading size. */}
          <PageHeaderSlot title="Weave Dashboard" />
        </div>
        <Card className="shrink-0">
          <CardContent>
            {principal ? (
              <span data-testid="principal-iri">
                <EntityRefSlot label={principal.sub} id={principal.principal_iri} />
              </span>
            ) : (
              <p data-testid="whoami-error">Unable to verify session with backend.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <PromptBarContainer />

      <ExplainBand
        tone="accent"
        icon="graph"
        body={
          <>
            <b className="text-[var(--color-text-default)]">How Weave works:</b> you model how the business runs in
            the Constitution — its processes, people, systems and rules. Weave then builds and runs apps and
            automations grounded in that model, and records every change in a tamper-evident audit trail. Change the
            model, and everything built on it re-checks itself.
          </>
        }
      />

      <NeedsYou />
      <BentoGrid entityCount={findEntityCount(defaultWidgets)} />

      <div className="grid gap-[var(--space-4)] lg:grid-cols-[1.4fr_1fr]">
        <ActivityFeed entries={activity} />
        <GetGoing />
      </div>

      <ChecklistWidget />
      <DashboardClient initialWidgets={widgets} initialLibraryItems={libraryItems} />
    </main>
  );
}
