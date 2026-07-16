import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { ChecklistWidget } from "@/components/onboarding/checklist-widget";
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

/** ponytail: plain server-side fetch, no client cache/SWR layer -- add one
 * if this page grows more than the reads below.
 */
async function fetchWhoami(accessToken: string): Promise<WhoamiResponse | null> {
  const backendUrl = backendApiUrl();
  const response = await fetch(`${backendUrl}/api/whoami`, {
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
  const backendUrl = backendApiUrl();
  const response = await fetch(
    `${backendUrl}/api/dashboard/widgets?scope=${scope}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  if (!response.ok) return [];
  const body = (await response.json()) as { widgets: WidgetOut[] };
  return body.widgets;
}

/** TASK-015 AC-4: initial tenant library list, server-rendered same as the
 * default widgets above -- client only re-fetches on publish/add mutations. */
async function fetchLibraryItems(accessToken: string): Promise<LibraryItemOut[]> {
  const backendUrl = backendApiUrl();
  const response = await fetch(`${backendUrl}/api/dashboard/library`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return [];
  const body = (await response.json()) as { items: LibraryItemOut[] };
  return body.items;
}

/** Protected page (middleware.ts enforces the redirect). Fetches
 * `/api/whoami` from the backend server-side to prove the session is
 * backed by a real, JWT-verified principal (Law B) -- not just a UI render.
 */
export default async function DashboardPage() {
  const session = await auth();
  const principal = session?.accessToken ? await fetchWhoami(session.accessToken) : null;
  const [defaultWidgets, userWidgets, libraryItems] = session?.accessToken
    ? await Promise.all([
        fetchDashboardWidgets(session.accessToken, "tenant_default"),
        fetchDashboardWidgets(session.accessToken, "user"),
        fetchLibraryItems(session.accessToken),
      ])
    : [[], [], []];
  const widgets = [...defaultWidgets, ...userWidgets];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-[var(--space-4)]">
      {/* AC-2: PageHeader organism -- --text-h1 title, no bespoke heading size. */}
      <PageHeaderSlot title="Weave Dashboard" />
      <Card>
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
      <Link
        href="/billing"
        className="text-[length:var(--text-body)] text-[var(--color-accent-primary)] underline"
      >
        View billing usage
      </Link>
      <Link
        href="/audit/compliance"
        className="text-[length:var(--text-body)] text-[var(--color-accent-primary)] underline"
      >
        View audit compliance
      </Link>
      <PromptBarContainer />
      <div className="w-full max-w-[1440px] px-[var(--space-5)]">
        <ChecklistWidget />
        <DashboardClient initialWidgets={widgets} initialLibraryItems={libraryItems} />
      </div>
    </main>
  );
}
