"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type Provider = "github" | "gitlab";

const PROVIDER_LABEL: Record<Provider, string> = { github: "GitHub", gitlab: "GitLab" };

/** Identity, not health -- unlike `BindingCard`'s `HealthBadge`, this never
 * reflects a connection-test result (TASK-023 GAPS: no "test connection" in
 * v1). Text label always accompanies the token colour (WCAG 1.4.1). */
export function ProviderBadge({ provider }: { provider: Provider }): React.JSX.Element {
  return <Badge variant="info">{PROVIDER_LABEL[provider]}</Badge>;
}

/** AC-1: write-only. Never pre-populated from any response and cleared by
 * the caller immediately after a successful submit -- this component holds
 * no memory of a previously-stored value. */
function ReplaceTokenField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-[var(--space-1)]">
      <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
        New token
      </span>
      <Input
        type="password"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ghp_... or glpat_..."
      />
    </label>
  );
}

function ProviderSelect({
  value,
  onChange,
}: {
  value: Provider;
  onChange: (value: Provider) => void;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-[var(--space-1)]">
      <span className="text-[length:var(--text-label)] text-[var(--color-text-muted)]">
        Provider
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Provider)}
        className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)]"
      >
        <option value="github">GitHub</option>
        <option value="gitlab">GitLab</option>
      </select>
    </label>
  );
}

/** AC-3/AC-4: the configure/replace form -- shared between the unconfigured
 * setup state and the configured "replace token" affordance. Only rendered
 * for `canManage` callers (UX gating; the server 403 on PUT is the real
 * boundary, see `rbac.py`'s `ProjectAction.SETTINGS`). */
export function SourceControlForm({
  initialProvider,
  saving,
  submitLabel,
  onSave,
}: {
  initialProvider: Provider;
  saving: boolean;
  submitLabel: string;
  onSave: (provider: Provider, token: string) => void;
}): React.JSX.Element {
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [token, setToken] = useState("");

  return (
    <div className="flex items-end gap-[var(--space-2)]">
      <ProviderSelect value={provider} onChange={setProvider} />
      <ReplaceTokenField value={token} onChange={setToken} />
      <Button
        type="button"
        disabled={!token || saving}
        onClick={() => {
          onSave(provider, token);
          setToken("");
        }}
      >
        {submitLabel}
      </Button>
    </div>
  );
}

/** AC-5: repo bootstrap fails closed without this -- the unconfigured
 * state is a setup prompt, not an error banner. Read-only callers see the
 * explanation only; the form is admin-only (`canManage`). */
export function SetupCard({
  canManage,
  saving,
  onSave,
}: {
  canManage: boolean;
  saving: boolean;
  onSave: (provider: Provider, token: string) => void;
}): React.JSX.Element {
  return (
    <Card>
      <CardTitle>Source control not configured</CardTitle>
      <CardContent>
        <p>Repo bootstrap fails closed without this -- a provider and token are required.</p>
        {canManage && (
          <div className="mt-[var(--space-3)]">
            <SourceControlForm
              initialProvider="github"
              saving={saving}
              submitLabel="Configure"
              onSave={onSave}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** AC-4: configured state shows the provider (identity) and the secret
 * *reference* only -- the stored token value is never fetched, held, or
 * displayed here. */
export function ConfiguredCard({
  provider,
  tokenSecretRef,
  configuredBy,
  configuredAt,
  canManage,
  saving,
  onSave,
}: {
  provider: Provider;
  tokenSecretRef: string;
  configuredBy: string;
  configuredAt: string;
  canManage: boolean;
  saving: boolean;
  onSave: (provider: Provider, token: string) => void;
}): React.JSX.Element {
  return (
    <Card>
      <div className="flex items-center gap-[var(--space-2)]">
        <CardTitle>Source control</CardTitle>
        <ProviderBadge provider={provider} />
      </div>
      <CardContent>
        <p className="font-[var(--font-mono)]">{tokenSecretRef}</p>
        {configuredBy && (
          <p className="text-[length:var(--text-caption)]">
            Configured by {configuredBy} at {configuredAt}
          </p>
        )}
        {canManage && (
          <div className="mt-[var(--space-3)]">
            <SourceControlForm
              initialProvider={provider}
              saving={saving}
              submitLabel="Replace token"
              onSave={onSave}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
