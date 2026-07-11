import { Badge } from "@/components/ui/badge";

import type { TaskTreeNode } from "./types";

/** AC-3: a `blocked_by` predecessor with no matching task is rendered as
 * its own flagged "missing dependency" node (`missing: true`, from
 * `build_task_tree`) rather than being dropped. Flat layered list -- the
 * brief's own fallback (no shared graph-rendering atom exists yet).
 */
export function TaskTree({ nodes }: { nodes: TaskTreeNode[] }): React.JSX.Element {
  return (
    <ul aria-label="Task dependency tree" className="flex flex-col gap-[var(--space-2)]">
      {nodes.map((node) => (
        <li
          key={node.id}
          data-testid="tree-node"
          data-missing={node.missing}
          className="flex items-center gap-[var(--space-2)]"
        >
          <span className="font-[var(--font-mono)] text-[length:var(--text-body-sm)]">
            {node.id}
          </span>
          {node.missing ? (
            <Badge variant="danger">missing dependency</Badge>
          ) : (
            <Badge variant="neutral">{node.status}</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
