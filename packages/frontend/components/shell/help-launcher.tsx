"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { t } from "@/lib/onboarding/i18n";
import { useWhatsNewUnread } from "@/lib/onboarding/use-whats-new-unread";

import { areaForPathname, CONTEXTUAL_HELP } from "../../../shared/onboarding/content/contextual-help";

const LINK_CLASS = "text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline";
const TEXT_FIELD_SELECTOR = "input, textarea, [contenteditable]";

/** ONB-TASK-013 implementation hint: single predicate for the ?-outside-a-
 * text-field guard (AC-013-03), unit-tested via the keyboard-shortcut cases
 * (Shift+? and bare ? both satisfy it -- "?" already requires Shift on a
 * standard layout, so a single check covers both phrasings in the AC). */
function isTextField(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(TEXT_FIELD_SELECTOR) !== null;
}

/** ONB-V1-TASK-002 AC-002-01: help-launcher entry into the completeness-map
 * tour, offered only while on an Explorer route -- the same deep-link the
 * ExplorerTour component autostarts on (`?tour=completeness-map`).
 *
 * ONB-TASK-013 partial-delivery note (now superseded by TASK-004's two
 * entries below): `/explorer`'s host was hardcoded to this one tour -- see
 * `.claude/state/escalations/ONB-TASK-013-partial.md`. */
function CompletenessTourEntry() {
  const pathname = usePathname();
  if (!pathname?.startsWith("/explorer")) return null;
  return (
    <a href="/explorer?tour=completeness-map" className={LINK_CLASS}>
      Take the completeness-map tour
    </a>
  );
}

/** ONB-V1-TASK-004 AC-004-01: same route-conditional deep-link pattern as
 * CompletenessTourEntry, into `tour.ge.trust-mechanics` (ExplorerTour's
 * second engine, `?tour=trust-mechanics`). */
function TrustMechanicsTourEntry() {
  const pathname = usePathname();
  if (!pathname?.startsWith("/explorer")) return null;
  return (
    <a href="/explorer?tour=trust-mechanics" className={LINK_CLASS}>
      Take the trust-mechanics tour
    </a>
  );
}

/** ONB-V1-TASK-004 AC-004-05: rules-policies deep-link, shown on the CE
 * rules route for every role. Role tailoring only narrows the *proactive*
 * offer (availableTours/onboarding path config) -- Business/Admin still
 * reach this tour through this link, so it's never a dead CTA. */
function RulesPoliciesTourEntry() {
  const pathname = usePathname();
  if (pathname !== "/ce/rules") return null;
  return (
    <a href="/ce/rules?tour=rules-policies" className={LINK_CLASS}>
      Take the rules-policies tour
    </a>
  );
}

/** IA §6 help content — thin M1 links; per-area contextual help and guided
 * tours land with the v1.0 docs surface. */
function HelpTopics() {
  return (
    <nav aria-label="Help topics" className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
      <p className="text-[length:var(--text-label)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        Get started
      </p>
      <a href="/role-home" className={LINK_CLASS}>
        What can Weave do for you? — your role-tailored capabilities and next step
      </a>
      <a href="/ce" className={LINK_CLASS}>
        Model your company — add Processes, Actors, Goals in the Constitution
      </a>
      <a href="/ce/query" className={LINK_CLASS}>
        Ask questions in plain language — Query the graph
      </a>
      <a href="/explorer" className={LINK_CLASS}>
        See the whole company — Graph Explorer
      </a>
      <CompletenessTourEntry />
      <TrustMechanicsTourEntry />
      <RulesPoliciesTourEntry />
      <a href="/build" className={LINK_CLASS}>
        Request an application generated from your model — Build
      </a>
      <a href="/audit" className={LINK_CLASS}>
        Every change, hash-chained — Audit trail
      </a>
      <p className="mt-[var(--space-2)] text-[length:var(--text-label)] text-[var(--color-text-muted)]">
        Docs, keyboard shortcuts, and per-area guides arrive with the v1.0 help centre.
      </p>
    </nav>
  );
}

/** ONB-TASK-013 AC-013-04: 2-4 links relevant to the active area, resolved
 * from the shared `CONTEXTUAL_HELP` config; hidden entirely when the area
 * has no entries (E7-S2 -- never an empty box). */
function ContextualHelpPanel() {
  const pathname = usePathname();
  const area = areaForPathname(pathname ?? null);
  const links = area ? CONTEXTUAL_HELP[area] : undefined;
  if (!links || links.length === 0) return null;

  return (
    <nav aria-label="Help for this page" className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
      <p className="text-[length:var(--text-label)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
        {t("onboarding.launcher.for-page.heading")}
      </p>
      {links.map((link) => (
        <a key={link.href + link.titleKey} href={link.href} className={LINK_CLASS}>
          {t(link.titleKey)}
        </a>
      ))}
    </nav>
  );
}

/** ONB-TASK-013 AC-013-06: unread-dot indicator on the "?" trigger, sourced
 * from TASK-012's own cursor hook (implementation hint -- never duplicate
 * the cursor logic here). */
function UnreadDot({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      data-testid="help-launcher-unread-dot"
      aria-hidden="true"
      className="absolute -right-0.5 -top-0.5 h-[6px] w-[6px] rounded-[var(--radius-full)] bg-[var(--color-accent-primary)]"
    />
  );
}

/** ONB-TASK-013 launcher entries composing the surfaces already shipped by
 * TASK-006 (path), TASK-008 (hints), TASK-010 (checklist), TASK-012
 * (training/what's-new) -- AC-013-05: every entry resolves a live surface. */
function LauncherEntries() {
  return (
    <div className="mt-[var(--space-4)] flex flex-col gap-[var(--space-2)]">
      <button
        type="button"
        onClick={() => void fetch("/api/onboarding/dismissals/beacon", { method: "DELETE" })}
        className={`${LINK_CLASS} text-left`}
      >
        {t("onboarding.launcher.show-hints")}
      </button>
      <a href="/help/training" className={LINK_CLASS}>
        {t("onboarding.launcher.training")}
      </a>
      <a href="/settings/onboarding-path" className={LINK_CLASS}>
        {t("onboarding.launcher.change-path")}
      </a>
    </div>
  );
}

/** ONB-TASK-013 AC-013-03: opens on Shift+? (or bare ? outside a text
 * field); Radix's own Escape handling closes the dialog, so this hook only
 * owns the open side. */
function useShortcutOpen(setOpen: (open: boolean) => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "?") return;
      if (isTextField(event.target)) return;
      setOpen(true);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setOpen]);
}

/** AC-7 / AC-013-03: "?" icon in the nav opens a contextual help panel in
 * place -- a Radix Dialog (focus-trap, Escape-to-close, restore-focus)
 * rather than a navigation to a /help route.
 */
export function HelpLauncher() {
  const [open, setOpen] = useState(false);
  const { unread } = useWhatsNewUnread();
  useShortcutOpen(setOpen);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Help"
          className="relative rounded-[var(--radius-full)] px-[var(--space-2)] py-[var(--space-1)] text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
        >
          ?
          <UnreadDot show={unread} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content
          aria-label="Help"
          className="fixed right-0 top-0 h-full w-full max-w-[360px] border-l border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]"
        >
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {t("onboarding.launcher.title")}
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            {t("onboarding.launcher.description")}
          </Dialog.Description>
          <ContextualHelpPanel />
          <HelpTopics />
          <LauncherEntries />
          {/* TASK-010 AC-010-05: restore a dismissed dashboard checklist. */}
          <button
            type="button"
            onClick={() => void fetch("/api/onboarding/checklist/restore", { method: "POST" })}
            className="mt-[var(--space-4)] text-[length:var(--text-body-sm)] text-[var(--color-accent-primary)] hover:underline"
          >
            {t("onboarding.checklist.restore")}
          </button>
          <p className="mt-[var(--space-4)] text-[length:var(--text-label)] text-[var(--color-text-muted)]">
            {t("onboarding.launcher.shortcuts.heading")}: {t("onboarding.launcher.shortcuts.open")} ·{" "}
            {t("onboarding.launcher.shortcuts.close")}
          </p>
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label="Close help"
              className="mt-[var(--space-4)] text-[length:var(--text-label)] text-[var(--color-text-muted)] hover:text-[var(--color-text-default)]"
            >
              Close
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
