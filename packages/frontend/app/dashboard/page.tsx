import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { PromptBarContainer } from "@/components/dashboard/prompt-bar-container";
import { WidgetGrid } from "@/components/dashboard/widget-grid";
import type { WidgetOut } from "@/components/dashboard/types";
import { auth } from "@/auth";

interface WhoamiResponse {
  sub: string;
  tenant_id: string;
  principal_iri: string;
}

/** ponytail: plain server-side fetch, no client cache/SWR layer -- add one
 * if this page grows more than the reads below.
 */
async function fetchWhoami(accessToken: string): Promise<WhoamiResponse | null> {
  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
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
async function fetchDashboardWidgets(accessToken: string): Promise<WidgetOut[]> {
  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  const response = await fetch(
    `${backendUrl}/api/dashboard/widgets?scope=tenant_default`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  if (!response.ok) return [];
  const body = (await response.json()) as { widgets: WidgetOut[] };
  return body.widgets;
}

/** Protected page (middleware.ts enforces the redirect). Fetches
 * `/api/whoami` from the backend server-side to prove the session is
 * backed by a real, JWT-verified principal (Law B) -- not just a UI render.
 */
export default async function DashboardPage() {
  const session = await auth();
  const principal = session?.accessToken ? await fetchWhoami(session.accessToken) : null;
  const widgets = session?.accessToken ? await fetchDashboardWidgets(session.accessToken) : [];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-[var(--space-4)]">
      {/* FAIL (ui_verify step B, axe page-has-heading-one): CardTitle renders
       * an h3, so the page had no h1 at all. This is the page's real title. */}
      <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Weave Dashboard
      </h1>
      <Card>
        <CardContent>
          {principal ? (
            <p data-testid="principal-iri">{principal.principal_iri}</p>
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
        href="/compliance"
        className="text-[length:var(--text-body)] text-[var(--color-accent-primary)] underline"
      >
        View audit compliance
      </Link>
      <PromptBarContainer />
      <div className="w-full max-w-[1440px] px-[var(--space-5)]">
        <WidgetGrid widgets={widgets} />
      </div>
    </main>
  );
}
