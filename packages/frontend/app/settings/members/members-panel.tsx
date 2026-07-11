"use client";

import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TablePage, type TablePageProps } from "@/components/templates/TablePage";
import { CANONICAL_ROLES } from "./roles";
import { useMembers, type Member } from "./use-members";

type DataTableColumn = TablePageProps["columns"][number];
type DataTableRow = TablePageProps["rows"][number];

const COLUMNS: DataTableColumn[] = [
  { key: "display_name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "actions", label: "" },
];

function toRow(member: Member, onRevoke: (userSub: string) => void): DataTableRow {
  return {
    id: member.user_sub ?? member.email,
    cells: {
      display_name: member.display_name,
      email: member.email,
      role: member.role,
      status: member.status,
      actions: member.user_sub ? (
        <Button
          type="button"
          variant="ghost"
          data-testid="revoke-member"
          onClick={(event) => {
            event.stopPropagation();
            onRevoke(member.user_sub as string);
          }}
        >
          Revoke
        </Button>
      ) : null,
    },
  };
}

function InviteForm({
  inviting,
  inviteError,
  onInvite,
}: {
  inviting: boolean;
  inviteError: string | null;
  onInvite: (email: string, role: string) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(CANONICAL_ROLES[0]?.slug ?? "viewer");

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (await onInvite(email, role)) {
      setEmail("");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-[var(--space-3)]">
      <Input
        aria-label="Email"
        type="email"
        placeholder="teammate@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <select
        aria-label="Role"
        data-testid="invite-role-select"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[var(--color-text-default)]"
      >
        {CANONICAL_ROLES.map((r) => (
          <option key={r.slug} value={r.slug}>
            {r.label}
          </option>
        ))}
      </select>

      {inviteError && (
        <p data-testid="invite-error" className="text-[var(--color-text-muted)]">
          {inviteError}
        </p>
      )}

      <Button type="submit" disabled={!email || inviting}>
        {inviting ? "Inviting…" : "Invite"}
      </Button>
    </form>
  );
}

/** Settings -> Members (AC-2): lists the active workspace's members via
 * `useMembers` and offers invite/revoke. Role selector is restricted to
 * the 10 canonical in-tenant roles (AC-3, `./roles.ts`).
 */
export function MembersPanel() {
  const { members, loadError, inviting, inviteError, invite, revoke } = useMembers();

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <TablePage
        title="Members"
        columns={COLUMNS}
        rows={(members ?? []).map((m) => toRow(m, (userSub) => void revoke(userSub)))}
        loading={members === null && !loadError}
        errorMessage={loadError ? "Unable to load members from backend." : undefined}
      />
      <Card>
        <p className="text-[length:var(--text-body)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          Invite a teammate
        </p>
        <CardContent>
          <InviteForm inviting={inviting} inviteError={inviteError} onInvite={invite} />
        </CardContent>
      </Card>
    </div>
  );
}
