import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { DashboardPlaceholder } from "@/components/dashboard/dashboard-placeholder";
import { auth } from "@/auth";

interface WhoamiResponse {
  sub: string;
  tenant_id: string;
  principal_iri: string;
}

/** ponytail: plain server-side fetch, no client cache/SWR layer -- add one
 * if this page grows more than the single read below.
 */
async function fetchWhoami(accessToken: string): Promise<WhoamiResponse | null> {
  const backendUrl = process.env.BACKEND_API_URL ?? "http://localhost:8000";
  const response = await fetch(`${backendUrl}/api/whoami`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  return response.ok ? ((await response.json()) as WhoamiResponse) : null;
}

/** Protected page (middleware.ts enforces the redirect). Fetches
 * `/api/whoami` from the backend server-side to prove the session is
 * backed by a real, JWT-verified principal (Law B) -- not just a UI render.
 */
export default async function DashboardPage() {
  const session = await auth();
  const principal = session?.accessToken ? await fetchWhoami(session.accessToken) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-[var(--space-4)]">
      <Card>
        <CardTitle>Weave Dashboard</CardTitle>
        <CardContent>
          {principal ? (
            <p data-testid="principal-iri">{principal.principal_iri}</p>
          ) : (
            <p data-testid="whoami-error">Unable to verify session with backend.</p>
          )}
        </CardContent>
      </Card>
      <DashboardPlaceholder />
    </main>
  );
}
