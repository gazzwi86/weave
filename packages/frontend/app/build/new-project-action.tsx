"use client";

import { useRouter } from "next/navigation";

import { NewProjectModal } from "./new-project-modal";

/** PageHeader action for the Registry page (AC-8): wraps `NewProjectModal`
 * with the post-create redirect to the new project's settings page --
 * extracted so the header (a server component) can render it without
 * itself needing `useRouter`. */
export function NewProjectAction(): React.JSX.Element {
  const router = useRouter();
  return (
    <NewProjectModal
      onCreated={(projectIri) =>
        router.push(`/build/projects/${encodeURIComponent(projectIri)}/settings`)
      }
    />
  );
}
