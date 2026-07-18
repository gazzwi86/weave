import { PageHeaderSlot } from "@/components/templates/PageHeaderSlot";

import { NewProjectAction } from "./new-project-action";
import { RegistryGrid } from "./registry-grid";

/** Build engine Registry (TASK-015, AC-1/AC-2/AC-8; refit-mock.html
 * #sub-bld-registry): the project list -- card grid + filter bar. Data
 * fetching is a client island (`RegistryGrid`); this shell is the
 * server-rendered page chrome. */
export default function BuildRegistryPage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col gap-[var(--space-6)] p-[var(--space-6)]">
      <PageHeaderSlot
        title="Projects"
        subtitle="Everything Weave is building or running for you — grounded in the Constitution."
        actions={<NewProjectAction />}
      />
      <RegistryGrid />
    </main>
  );
}
