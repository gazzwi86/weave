"use client";

import { useCallback, useEffect, useState } from "react";

import { ConfiguredCard, type Provider, SetupCard } from "./source-control-card";

interface SourceControlConfig {
  provider: Provider;
  token_secret_ref: string;
  configured_by: string;
  configured_at: string;
}

type LoadState = "loading" | "unconfigured" | "configured" | "load-error";

/** GET .../source-control -- a 404 means "no such project" or "not yet
 * configured" (AC-5); the frontend treats both as the normal setup state,
 * never an error banner. Refetches whenever `version` bumps (same
 * refetch-on-version pattern as `binding-slots.tsx`'s `useBindings`). */
function useSourceControl(
  projectId: string,
  version: number
): { state: LoadState; config: SourceControlConfig | null } {
  const [state, setState] = useState<LoadState>("loading");
  const [config, setConfig] = useState<SourceControlConfig | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/build/projects/${projectId}/source-control`, { signal: controller.signal })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        if (res.status === 404) {
          setConfig(null);
          setState("unconfigured");
          return;
        }
        if (!res.ok) {
          setState("load-error");
          return;
        }
        setConfig((await res.json()) as SourceControlConfig);
        setState("configured");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("load-error");
      });
    return () => controller.abort();
  }, [projectId, version]);

  return { state, config };
}

/** PUT .../source-control -- AC-1: the token value is sent once and never
 * re-read from any response; the caller clears its own field on submit
 * regardless of outcome (`SourceControlForm`). */
function useSourceControlSave(
  projectId: string,
  onSaved: () => void
): { saving: boolean; saveError: string | null; save: (provider: Provider, token: string) => void } {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = useCallback(
    (provider: Provider, token: string) => {
      setSaving(true);
      setSaveError(null);
      fetch(`/api/build/projects/${projectId}/source-control`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, token }),
      })
        .then((res) => {
          if (!res.ok) {
            setSaveError("Could not save. Try again shortly.");
            return;
          }
          onSaved();
        })
        .catch(() => setSaveError("Could not save. Try again shortly."))
        .finally(() => setSaving(false));
    },
    [projectId, onSaved]
  );

  return { saving, saveError, save };
}

/** TASK-023 (E2-S6, FR-061/B9): the "Source control" settings tab. Admin
 * edit is UX-only gating via `canManage` (`deriveProjectRole` upstream) --
 * the real boundary is the backend PUT's `require_project_role(SETTINGS)`
 * 403. No org/repo/ref fields, no "test connection", no remove affordance
 * (brief's GAPS section -- none of these exist in v1). */
export function SourceControlTab({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}): React.JSX.Element | null {
  const [version, setVersion] = useState(0);
  const { state, config } = useSourceControl(projectId, version);
  const { saving, saveError, save } = useSourceControlSave(projectId, () =>
    setVersion((v) => v + 1)
  );

  if (state === "loading") return null;
  if (state === "load-error") {
    return (
      <p role="alert" className="text-[var(--color-danger)]">
        Could not load source control settings.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {saveError && (
        <p role="alert" className="text-[var(--color-danger)]">
          {saveError}
        </p>
      )}
      {state === "configured" && config ? (
        <ConfiguredCard
          provider={config.provider}
          tokenSecretRef={config.token_secret_ref}
          configuredBy={config.configured_by}
          configuredAt={config.configured_at}
          canManage={canManage}
          saving={saving}
          onSave={save}
        />
      ) : (
        <SetupCard canManage={canManage} saving={saving} onSave={save} />
      )}
    </div>
  );
}
