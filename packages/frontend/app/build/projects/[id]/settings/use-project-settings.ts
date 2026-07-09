import { useCallback, useEffect, useState } from "react";

import { type ContributorRow, deriveProjectRole } from "@/lib/build/derive-role";

import type { GovernanceValues } from "./governance-form";

interface SettingsResponse {
  model_tier: string;
  model_tier_source: string;
  cost_cap_usd: number | null;
  cost_cap_source: string | null;
}

function toValues(settings: SettingsResponse): GovernanceValues {
  return {
    modelTier: settings.model_tier,
    costCap: settings.cost_cap_usd === null ? "" : String(settings.cost_cap_usd),
  };
}

/** Loads the resolved settings cascade (AC-2) once on mount -- split out of
 * `useProjectSettings` to keep both under the function-length budget. */
function useSettingsLoad(projectId: string): {
  settings: SettingsResponse | null;
  setSettings: (settings: SettingsResponse) => void;
} {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);

  useEffect(() => {
    fetch(`/api/build/projects/${projectId}/settings`)
      .then((res) => res.json() as Promise<SettingsResponse>)
      .then(setSettings)
      .catch(() => undefined);
  }, [projectId]);

  return { settings, setSettings };
}

/** AC-4: fetches contributors once on mount purely to derive the caller's
 * effective role -- `ContributorsTab` fetches its own copy for display when
 * its tab is selected, so the tenant/company-wide role check here doesn't
 * gate rendering the rest of this page on that tab ever being opened. */
function useCanManage(projectId: string, tenantRole: string | null, principalIri: string | null): boolean {
  const [contributors, setContributors] = useState<ContributorRow[]>([]);

  useEffect(() => {
    fetch(`/api/build/projects/${projectId}/contributors`)
      .then((res) => res.json() as Promise<{ items: ContributorRow[] }>)
      .then((body) => setContributors(body.items))
      .catch(() => undefined);
  }, [projectId]);

  return deriveProjectRole(tenantRole, principalIri, contributors) === "admin";
}

export interface ProjectSettingsState {
  values: GovernanceValues | null;
  source: { modelTier: string; costCap: string | null } | null;
  canManage: boolean;
  saving: boolean;
  error: string | null;
  saved: boolean;
  setValues: (values: GovernanceValues) => void;
  save: () => void;
}

/** PATCH-on-save -- split out of `useProjectSettings` to keep both under
 * the function-length budget. `edited` reverts to null (falls back to the
 * freshly-saved `settings` snapshot) on success, so the form always shows
 * server-confirmed values right after a save. */
function useSave(
  projectId: string,
  edited: GovernanceValues | null,
  onSaved: (settings: SettingsResponse) => void
): { saving: boolean; error: string | null; saved: boolean; save: () => void } {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useCallback(() => {
    if (!edited) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    fetch(`/api/build/projects/${projectId}/settings`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model_tier: edited.modelTier,
        cost_cap_usd: edited.costCap === "" ? null : Number(edited.costCap),
      }),
    })
      .then(async (res) => {
        const body = (await res.json()) as SettingsResponse & { error?: string };
        if (!res.ok) {
          setError(describeError(body));
          return;
        }
        onSaved(body);
        setSaved(true);
      })
      .catch(() => setError("Unable to save -- try again shortly."))
      .finally(() => setSaving(false));
  }, [projectId, edited, onSaved]);

  return { saving, error, saved, save };
}

/** Drives the governance tab: GET-then-render, PATCH-on-save, with AC-3's
 * `cap_looser_than_parent` 422 and the 503 project-scope-unavailable error
 * both surfaced as the raw backend message (Law 13 -- proxy validates
 * shape only, this hook renders whatever it says). */
export function useProjectSettings(
  projectId: string,
  tenantRole: string | null,
  principalIri: string | null
): ProjectSettingsState {
  const { settings, setSettings } = useSettingsLoad(projectId);
  const canManage = useCanManage(projectId, tenantRole, principalIri);
  const [edited, setEdited] = useState<GovernanceValues | null>(null);
  const values = edited ?? (settings ? toValues(settings) : null);

  const onSaved = useCallback(
    (body: SettingsResponse) => {
      setSettings(body);
      setEdited(null);
    },
    [setSettings]
  );
  const { saving, error, saved, save } = useSave(projectId, values, onSaved);

  return {
    values,
    source: settings ? { modelTier: settings.model_tier_source, costCap: settings.cost_cap_source } : null,
    canManage,
    saving,
    error,
    saved,
    setValues: setEdited,
    save,
  };
}

function describeError(body: { error?: string; level?: string; parent_cap_usd?: number }): string {
  if (body.error === "cap_looser_than_parent") {
    return `The cost cap must be no looser than the ${body.level} cap ($${body.parent_cap_usd}).`;
  }
  if (body.error === "project_scope_settings_unavailable") {
    return "Project-level settings changes are temporarily unavailable -- try again later.";
  }
  return "Unable to save that change.";
}
