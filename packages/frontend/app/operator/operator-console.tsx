"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ExplainBand } from "@/components/ui/explain-band";
import { InfoTip } from "@/components/ui/info-tip";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { TablePage, type TablePageProps } from "@/components/templates/TablePage";
import {
  provisionTenant,
  STUB_TENANTS,
  suspendTenant,
  summarizeTenants,
  type Tenant,
} from "@/lib/operator/tenants";

// app/** may not import components/organisms directly (weave/app-layer-boundary)
// -- derive the row type from TablePage's own prop shape instead.
type DataTableRow = TablePageProps["rows"][number];

const COLUMNS = [
  { key: "company", label: "Company" },
  { key: "members", label: "Members" },
  { key: "entities", label: "Entities" },
  { key: "model", label: "Model" },
  { key: "status", label: "Status" },
  { key: "created", label: "Created" },
];

function toRow(tenant: Tenant): DataTableRow {
  return {
    id: tenant.id,
    cells: {
      company: (
        <div className="flex items-center gap-[var(--space-3)]">
          <span
            aria-hidden="true"
            className="flex h-[var(--space-6)] w-[var(--space-6)] items-center justify-center rounded-[var(--radius-sm)] bg-[image:var(--gradient-accent)] text-[length:var(--text-caption)] font-[var(--font-weight-bold)] text-[var(--color-bg)]"
          >
            {tenant.monogram}
          </span>
          <div>
            <div className="font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
              {tenant.name}
            </div>
            <div className="text-[length:var(--text-caption)] text-[var(--color-text-subtle)]">
              {tenant.industry} &middot; {tenant.region}
            </div>
          </div>
        </div>
      ),
      members: tenant.members,
      entities: tenant.entities.toLocaleString(),
      model: tenant.modelVersion,
      status: <StatusPill status={tenant.status} />,
      created: tenant.createdAt,
    },
  };
}

function RowActions({ tenant, onSuspend }: { tenant: Tenant; onSuspend: (id: string) => void }) {
  return (
    <div className="flex items-center gap-[var(--space-2)]">
      <Link
        href="/dashboard"
        className="text-[length:var(--text-caption)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
      >
        Open
      </Link>
      {tenant.status === "active" ? (
        <button
          type="button"
          onClick={() => onSuspend(tenant.id)}
          className="text-[length:var(--text-caption)] text-[var(--color-text-muted)] hover:text-[var(--color-danger)]"
        >
          Suspend
        </button>
      ) : null}
    </div>
  );
}

function ProvisionDialog({ onProvision }: { onProvision: (name: string) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");

  function handleSubmit() {
    if (!name.trim()) return;
    onProvision(name.trim());
    setName("");
    dialogRef.current?.close();
  }

  return (
    <>
      <Button onClick={() => dialogRef.current?.showModal()}>Provision company</Button>
      <dialog
        ref={dialogRef}
        className="m-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-6)] backdrop:bg-[var(--color-overlay)] backdrop:opacity-80"
      >
        <div className="flex w-[280px] flex-col gap-[var(--space-3)]">
          <label
            htmlFor="operator-provision-name"
            className="text-[length:var(--text-caption)] text-[var(--color-text-muted)]"
          >
            Company name
          </label>
          <Input
            id="operator-provision-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="flex justify-end gap-[var(--space-2)]">
            <Button variant="ghost" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Provision</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

/** Super-admin cross-tenant console (refit-mock.html `#screen-operator`).
 * UI-only against the stub tenant list (lib/operator/tenants.ts) -- swap for
 * real CE-OPERATOR-1-style fetches once gap G15's list/provision/suspend
 * endpoints land (docs/design/remediation-2-api-gaps.md). */
export function OperatorConsole() {
  const [tenants, setTenants] = useState<Tenant[]>(STUB_TENANTS);
  const summary = summarizeTenants(tenants);

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <div className="text-[length:var(--text-caption)] font-[var(--font-weight-semibold)] text-[var(--color-warn)]">
        Platform &middot; Operator console
      </div>
      <TablePage
        title="Companies"
        titleTrailing={
          <InfoTip
            title="Operator console"
            body="The platform-level area for super admins. Each company is a fully isolated tenant — its model, members and audit trail are invisible to every other company. Actions here provision, suspend or open those tenants."
          />
        }
        subtitle="Provision, open and manage isolated company tenants."
        actions={
          <>
            <Link
              href="/dashboard"
              className="inline-flex items-center rounded-[var(--radius-base)] border border-[var(--color-border)] px-[var(--space-4)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"
            >
              Back to Hammerbarn
            </Link>
            <ProvisionDialog
              onProvision={(name) => setTenants((current) => provisionTenant(current, name))}
            />
          </>
        }
        banner={
          <>
            <ExplainBand
              tone="warn"
              icon="shield"
              body={
                <>
                  <b>You are outside any company.</b> Each tenant below is fully isolated — separate
                  model, members, shapes and audit chain. Provisioning creates the tenant, seeds the
                  framework kinds, and invites the first admin. Suspending freezes access without
                  touching data.
                </>
              }
            />
            <div className="grid grid-cols-3 gap-[var(--space-3)]">
              <StatCard value={String(summary.companies)} label="companies" />
              <StatCard value={String(summary.membersAcrossTenants)} label="members across tenants" />
              <StatCard value={summary.auditChainsValid} label="audit chains valid" tone="ok" />
            </div>
          </>
        }
        columns={COLUMNS}
        rows={tenants.map(toRow)}
        renderRowActions={(row) => {
          const tenant = tenants.find((t) => t.id === row.id);
          if (!tenant) return null;
          return (
            <RowActions
              tenant={tenant}
              onSuspend={(id) => setTenants((current) => suspendTenant(current, id))}
            />
          );
        }}
      />
    </div>
  );
}
