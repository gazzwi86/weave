import Link from "next/link";

import { auth } from "@/auth";
import { getPrincipalIri, getSessionClaims } from "@/lib/auth/session-claims";

import { ProjectSettingsPanel } from "./project-settings-panel";

/** TASK-015 project settings page (AC-1..AC-7, EPIC-002). Role gating for
 * the governance/contributors controls happens client-side in
 * `ProjectSettingsPanel` (`deriveProjectRole`) -- this server shell just
 * resolves the caller's tenant role + principal once, same shape as
 * `settings/workspaces/page.tsx`. */
export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  const session = await auth();
  const { role: tenantRole } = getSessionClaims(session?.accessToken);
  const principalIri = getPrincipalIri(session?.accessToken);

  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-4)] p-[var(--space-6)]">
      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2-line)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Project settings
        </h1>
        <Link
          href={`/build/projects/${encodeURIComponent(id)}/decisions`}
          className="text-[length:var(--text-body)] text-[var(--color-accent-primary)] hover:underline"
        >
          Decision log
        </Link>
      </div>
      <ProjectSettingsPanel projectId={id} tenantRole={tenantRole} principalIri={principalIri} />
    </main>
  );
}
