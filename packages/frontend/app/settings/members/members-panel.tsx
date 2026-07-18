"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { TablePage, type TablePageProps } from "@/components/templates/TablePage";
import { FilterBar, type FilterChip } from "@/components/ui/filter-bar";
import { Icon } from "@/components/ui/icon";
import { StatusPill, type Status } from "@/components/ui/status-pill";
import { InviteMemberModal } from "./invite-member-modal";
import { CANONICAL_ROLES } from "./roles";
import { useMembers, type Member } from "./use-members";

type DataTableColumn = TablePageProps["columns"][number];
type DataTableRow = TablePageProps["rows"][number];

const COLUMNS: DataTableColumn[] = [
  { key: "member", label: "Member" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  // ponytail: mock's "Last active" column has no backing signal -- no
  // session/activity tracking exists (`MemberOut` has no such field) -- so
  // this reports the real `invited_at` date instead of fabricating one.
  { key: "invited", label: "Invited" },
];

const CHIPS: FilterChip[] = [
  { id: "all", label: "All" },
  { id: "admins", label: "Admins" },
  { id: "modellers", label: "Modellers" },
  { id: "agents", label: "Agents" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0]!.charAt(0) + (parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "")).toUpperCase();
}

function toStatus(status: string): Status {
  return status === "active" ? "active" : "draft";
}

function matchesChip(member: Member, chipId: string): boolean {
  if (chipId === "admins") return member.role === "workspace_admin";
  // ponytail: G14 -- `use-members.ts`'s `Member` is human-only
  // (email/role/status), the members API has no agent-principal concept
  // yet, so no row can ever match "Agents" -- an honest empty state, not a
  // fabricated "Build agent" row.
  if (chipId === "agents") return false;
  if (chipId === "modellers") return member.role !== "workspace_admin";
  return true;
}

function matchesSearch(member: Member, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return member.display_name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q);
}

function MemberCell({ member }: { member: Member }) {
  return (
    <div className="flex items-center gap-[var(--space-3)]">
      <span
        aria-hidden="true"
        className="flex h-[var(--space-6)] w-[var(--space-6)] shrink-0 items-center justify-center rounded-[var(--radius-full)] bg-[image:var(--gradient-accent)] text-[length:var(--text-caption)] font-[var(--font-weight-bold)] text-[var(--color-bg)]"
      >
        {initials(member.display_name)}
      </span>
      <div className="flex flex-col">
        <span className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
          {member.display_name}
        </span>
        <span className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">{member.email}</span>
      </div>
    </div>
  );
}

/** Role is shown, not editable: `invite()` (the only role-touching client
 * call) upserts by email and 409s on an already-active member, so there is
 * no update-role-for-active-member endpoint yet -- disabled rather than a
 * control that would always fail (gap G16). */
function RoleCell({ member }: { member: Member }) {
  return (
    <select
      aria-label={`Role for ${member.display_name}`}
      value={member.role}
      disabled
      title="Role changes aren't supported yet (gap G16)."
      className="rounded-[var(--radius-base)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-body-sm)] text-[var(--color-text-default)] disabled:opacity-70"
    >
      {CANONICAL_ROLES.map((r) => (
        <option key={r.slug} value={r.slug}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

function toRow(member: Member): DataTableRow {
  return {
    id: member.user_sub ?? member.email,
    cells: {
      member: <MemberCell member={member} />,
      role: <RoleCell member={member} />,
      status: <StatusPill status={toStatus(member.status)} />,
      invited: new Date(member.invited_at).toLocaleDateString(),
    },
  };
}

function useMemberFilters(members: Member[] | null) {
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState("all");

  const filtered = useMemo(
    () => (members ?? []).filter((m) => matchesChip(m, chip) && matchesSearch(m, search)),
    [members, chip, search]
  );

  return { search, setSearch, chip, setChip, filtered };
}

function RevokeAction({ member, onRevoke }: { member: Member; onRevoke: (userSub: string) => void }) {
  if (!member.user_sub) return null;
  const userSub = member.user_sub;
  return (
    <button
      type="button"
      aria-label={`Revoke ${member.display_name}`}
      onClick={() => onRevoke(userSub)}
      className="rounded-[var(--radius-sm)] p-[var(--space-1)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
    >
      <Icon name="trash" size={13} />
    </button>
  );
}

/** Settings -> Members (AC-2, mock `#sub-set-members`): lists the active
 * workspace's members via `useMembers` in a FilterBar + DataTable, with
 * invite handled by a `ModalShell`-based modal (`invite-member-modal.tsx`).
 */
export function MembersPanel() {
  const { members, loadError, inviting, inviteError, invite, revoke } = useMembers();
  const { search, setSearch, chip, setChip, filtered } = useMemberFilters(members);
  const [modalOpen, setModalOpen] = useState(false);

  const rows = filtered.map(toRow);
  const findMember = (id: string) => filtered.find((m) => (m.user_sub ?? m.email) === id);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <TablePage
        title="Members"
        subtitle="Who's in the workspace and what they can do."
        actions={
          <Button type="button" variant="secondary" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={13} />
            Invite member
          </Button>
        }
        filterBar={
          <FilterBar
            chips={CHIPS}
            activeIds={[chip]}
            onToggle={setChip}
            search={{ value: search, onChange: setSearch, label: "Search members", placeholder: "Search members…" }}
          />
        }
        columns={COLUMNS}
        rows={rows}
        loading={members === null && !loadError}
        errorMessage={loadError ? "Unable to load members from backend." : undefined}
        renderRowActions={(row) => {
          const member = findMember(row.id);
          return member ? <RevokeAction member={member} onRevoke={(sub) => void revoke(sub)} /> : null;
        }}
      />

      <InviteMemberModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        inviting={inviting}
        inviteError={inviteError}
        onInvite={invite}
      />
    </div>
  );
}
