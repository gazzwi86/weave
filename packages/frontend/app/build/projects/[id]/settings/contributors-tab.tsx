"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Contributor {
  principal_iri: string;
  role: string;
}

/** Fetches the contributor list whenever `version` changes -- split out to
 * keep `ContributorsTab` under the function-length budget (same shape as
 * `useWorkspaceList`). */
function useContributorList(
  projectId: string,
  version: number
): Contributor[] | null {
  const [contributors, setContributors] = useState<Contributor[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/build/projects/${projectId}/contributors`, { signal: controller.signal })
      .then((res) => res.json() as Promise<{ items: Contributor[] }>)
      .then((body) => {
        if (!controller.signal.aborted) setContributors(body.items);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [projectId, version]);

  return contributors;
}

/** The list table -- split out of `ContributorsTab` to keep both under the
 * function-length budget (Law E). */
function ContributorTable({
  contributors,
  canManage,
  onRemove,
}: {
  contributors: Contributor[];
  canManage: boolean;
  onRemove: (principalIri: string) => void;
}): React.JSX.Element {
  return (
    <table className="w-full text-left text-[length:var(--text-body)]">
      <thead>
        <tr className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          <th className="pb-[var(--space-2)]">Principal</th>
          <th className="pb-[var(--space-2)]">Role</th>
          {canManage && <th className="pb-[var(--space-2)]">&nbsp;</th>}
        </tr>
      </thead>
      <tbody>
        {contributors.map((contributor) => (
          <tr key={contributor.principal_iri} className="border-t border-[var(--color-border)]">
            <td className="py-[var(--space-2)] font-[var(--font-mono)]">
              {contributor.principal_iri}
            </td>
            <td className="py-[var(--space-2)]">
              <Badge variant={contributor.role === "admin" ? "info" : "neutral"}>
                {contributor.role}
              </Badge>
            </td>
            {canManage && (
              <td className="py-[var(--space-2)] text-right">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => onRemove(contributor.principal_iri)}
                >
                  Remove
                </Button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The admin-only add-contributor row -- split out of `ContributorsTab` to
 * keep both under the function-length budget (Law E). */
function AddContributorForm({
  onAdd,
}: {
  onAdd: (principalIri: string, role: "admin" | "editor") => void;
}): React.JSX.Element {
  const [principal, setPrincipal] = useState("");
  const [role, setRole] = useState<"admin" | "editor">("editor");

  return (
    <div className="flex items-end gap-[var(--space-2)]">
      <label className="flex flex-1 flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
          New contributor principal
        </span>
        <Input value={principal} onChange={(e) => setPrincipal(e.target.value)} />
      </label>
      <label className="flex flex-col gap-[var(--space-1)]">
        <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">Role</span>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "admin" | "editor")}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)]"
        >
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <Button
        type="button"
        disabled={!principal}
        onClick={() => {
          onAdd(principal, role);
          setPrincipal("");
        }}
      >
        Add contributor
      </Button>
    </div>
  );
}

/** TASK-015 AC-5: contributor list -- every project is readable company-wide
 * (a role grant only ever ADDS write access), so the tab always renders the
 * list; add/remove/role controls are admin-only (`canManage`, derived
 * upstream via `deriveProjectRole`). */
export function ContributorsTab({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}): React.JSX.Element {
  const [version, setVersion] = useState(0);
  const contributors = useContributorList(projectId, version);

  const addContributor = useCallback(
    (principalIri: string, role: "admin" | "editor") => {
      fetch(`/api/build/projects/${projectId}/contributors`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ principal_iri: principalIri, role }),
      })
        .then(() => setVersion((v) => v + 1))
        .catch(() => undefined);
    },
    [projectId]
  );

  const removeContributor = useCallback(
    (principalIri: string) => {
      fetch(`/api/build/projects/${projectId}/contributors/${encodeURIComponent(principalIri)}`, {
        method: "DELETE",
      })
        .then(() => setVersion((v) => v + 1))
        .catch(() => undefined);
    },
    [projectId]
  );

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <p className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]">
        Every contributor listed here can read this project; read access is company-wide. A role
        grant only adds write access.
      </p>
      <ContributorTable
        contributors={contributors ?? []}
        canManage={canManage}
        onRemove={removeContributor}
      />
      {canManage && <AddContributorForm onAdd={addContributor} />}
    </div>
  );
}
