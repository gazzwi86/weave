"use client";

import { useState, useSyncExternalStore } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useGeneralSettings } from "./use-general-settings";

const FIELD_LABEL_CLASS = "text-[length:var(--text-body-sm)] text-[var(--color-text-default)]";
const NATIVE_FIELD_CLASS =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[length:var(--text-body)] text-[var(--color-text-default)] disabled:pointer-events-none disabled:opacity-50";

/** SSR-safe subscription to a `matchMedia` query, via React's own tool for
 * synchronising with a browser-only external system (avoids both a
 * hydration mismatch and a setState-in-effect lint violation). */
function subscribeToMediaQuery(query: string) {
  return (onChange: () => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    const mediaQueryList = window.matchMedia(query);
    mediaQueryList.addEventListener("change", onChange);
    return () => mediaQueryList.removeEventListener("change", onChange);
  };
}

function snapshotMediaQuery(query: string) {
  return () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

const getServerSnapshot = () => false;
const subscribeDark = subscribeToMediaQuery("(prefers-color-scheme: dark)");
const getDarkSnapshot = snapshotMediaQuery("(prefers-color-scheme: dark)");
const subscribeReducedMotion = subscribeToMediaQuery("(prefers-reduced-motion: reduce)");
const getReducedMotionSnapshot = snapshotMediaQuery("(prefers-reduced-motion: reduce)");

/** Seeds Appearance from the OS-level signal, then lets a click override it
 * locally (display-only -- see the `AppearanceCard` doc comment). */
function useAppearanceState() {
  const osDark = useSyncExternalStore(subscribeDark, getDarkSnapshot, getServerSnapshot);
  const osReducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, getServerSnapshot);
  const [darkOverride, setDarkOverride] = useState<boolean | null>(null);
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);

  return {
    dark: darkOverride ?? osDark,
    setDark: setDarkOverride,
    reducedMotion: motionOverride ?? osReducedMotion,
    setReducedMotion: setMotionOverride,
  };
}

/** SE1's tenant-admin-gated write (`PUT /api/tenancy/workspaces/{id}`):
 * edits locally, saves on blur. Split out of `WorkspaceCard` to keep both
 * under the 50-line function budget. */
function WorkspaceDescriptionField({
  description,
  saveError,
  saveDescription,
}: {
  description: string | null;
  saveError: boolean;
  saveDescription: (next: string) => Promise<void>;
}) {
  const [descriptionDraft, setDescriptionDraft] = useState(description ?? "");
  // React's documented "adjusting state when a prop changes" pattern --
  // setState during render (not in an effect) so a fresh `description` from
  // the load resets the draft without an extra committed render.
  const [trackedDescription, setTrackedDescription] = useState(description);
  if (description !== trackedDescription) {
    setTrackedDescription(description);
    setDescriptionDraft(description ?? "");
  }

  return (
    <label className="flex flex-col gap-[var(--space-1)]">
      <span className={FIELD_LABEL_CLASS}>Description</span>
      <textarea
        aria-label="Workspace description"
        rows={2}
        value={descriptionDraft}
        onChange={(e) => setDescriptionDraft(e.target.value)}
        onBlur={() => {
          if (descriptionDraft !== (description ?? "")) void saveDescription(descriptionDraft);
        }}
        className={NATIVE_FIELD_CLASS}
      />
      {saveError && (
        <span className="text-[length:var(--text-body-sm)] text-[var(--color-danger)]">
          Couldn&apos;t save the description.
        </span>
      )}
    </label>
  );
}

/** Settings -> General (mock `#sub-set-general`): the Workspace card.
 * Name and Region stay disabled -- no endpoint exists for either yet (same
 * "show not fabricate" gap as Members' RoleCell/G16). */
function WorkspaceCard({
  workspaceName,
  description,
  saveError,
  saveDescription,
}: {
  workspaceName: string | null;
  description: string | null;
  saveError: boolean;
  saveDescription: (next: string) => Promise<void>;
}) {
  return (
    <Card>
      <h3>
        <Eyebrow as="span">Workspace</Eyebrow>
      </h3>
      <CardContent className="flex flex-col gap-[var(--space-3)]">
        <label className="flex flex-col gap-[var(--space-1)]">
          <span className={FIELD_LABEL_CLASS}>Name</span>
          <Input
            aria-label="Workspace name"
            value={workspaceName ?? ""}
            disabled
            readOnly
            title="Renaming a workspace isn't supported yet."
          />
        </label>
        <WorkspaceDescriptionField
          description={description}
          saveError={saveError}
          saveDescription={saveDescription}
        />
        <label className="flex flex-col gap-[var(--space-1)]">
          <span className={FIELD_LABEL_CLASS}>Region</span>
          <select
            aria-label="Workspace region"
            disabled
            title="Region is locked by policy."
            className={NATIVE_FIELD_CLASS}
          >
            <option>Locked by policy</option>
          </select>
        </label>
      </CardContent>
    </Card>
  );
}

/** ponytail: Theme/Reduced-motion flip local state only -- no ThemeProvider
 * or class-based override exists anywhere in the app yet (dark/light and
 * motion-reduction are pure OS-level `@media` queries in globals.css), so
 * toggling repaints nothing today. Wire a real override when a theme
 * system lands; until then this is an honest OS-seeded, display-only
 * control rather than a fake persisted preference. */
function AppearanceCard() {
  const { dark, setDark, reducedMotion, setReducedMotion } = useAppearanceState();

  return (
    <Card>
      <h3>
        <Eyebrow as="span">Appearance</Eyebrow>
      </h3>
      <CardContent className="flex flex-col gap-[var(--space-2)]">
        <div className="flex items-center justify-between gap-[var(--space-3)]">
          <span className={FIELD_LABEL_CLASS}>Dark mode</span>
          <Switch
            aria-label="Dark mode"
            data-testid="toggle-theme"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
          />
        </div>
        <div className="flex items-center justify-between gap-[var(--space-3)]">
          <span className={FIELD_LABEL_CLASS}>Reduce motion</span>
          <Switch
            aria-label="Reduce motion"
            data-testid="toggle-reduced-motion"
            checked={reducedMotion}
            onChange={(e) => setReducedMotion(e.target.checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/** Settings -> General (mock `#sub-set-general`): workspace identity +
 * appearance. The settings index route's landing page. */
export function GeneralPanel() {
  const { workspaceName, description, loadError, saveError, saveDescription } = useGeneralSettings();

  if (loadError) {
    return (
      <p data-testid="workspace-error" className="text-[var(--color-text-muted)]">
        Unable to load workspace details.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      <WorkspaceCard
        workspaceName={workspaceName}
        description={description}
        saveError={saveError}
        saveDescription={saveDescription}
      />
      <AppearanceCard />
    </div>
  );
}
