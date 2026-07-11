import { useEffect, useState } from "react";

import { type ContributorRow, deriveProjectRole } from "@/lib/build/derive-role";

/** BE-V1-TASK-021 (FR-065): AC-1/AC-2 UX mirror -- editors and admins can
 * prompt (backend's `ProjectAction.PROMPT`, rbac.py), readers cannot. Same
 * fetch-contributors-once-derive-role shape as `useCanManage`
 * (`settings/use-project-settings.ts`), widened to accept "editor" too.
 * The real 403 boundary is server-side; this only shapes which controls
 * render. */
export function usePromptAccess(
  projectId: string,
  tenantRole: string | null,
  principalIri: string | null
): boolean {
  const [contributors, setContributors] = useState<ContributorRow[]>([]);

  useEffect(() => {
    fetch(`/api/build/projects/${projectId}/contributors`)
      .then((res) => res.json() as Promise<{ items: ContributorRow[] }>)
      .then((body) => setContributors(body.items))
      .catch(() => undefined);
  }, [projectId]);

  return deriveProjectRole(tenantRole, principalIri, contributors) !== null;
}
