"use client";

import * as Dialog from "@radix-ui/react-dialog";

import { Button } from "../ui/button";
import { t } from "../../lib/onboarding/i18n";
import type { WelcomeModal as WelcomeModalConfig } from "../../../shared/onboarding/content/schema";

export interface WelcomeModalProps {
  modal: WelcomeModalConfig;
  onDismiss: () => void;
  onStartTour: (tourId: string) => void;
}

const CONTENT_CLASSES =
  "fixed left-1/2 top-1/2 w-full max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-[var(--radius-base)] " +
  "border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-5)] shadow-[var(--shadow-panel)]";

/** ONB-TASK-008 AC-008-04/05: first-visit welcome modal per shipped area,
 * dismissed on any CTA (bootstrap-read gating -- "no dismissal row" -- lives
 * in the caller, this component just renders + fires onDismiss once). CTAs
 * come straight from config (ADR-006/TASK-003) -- "explore-freely" and
 * "read-the-guide" have no navigation target in the schema, so they just
 * dismiss; only "tour" also starts a tour. */
export function WelcomeModal({ modal, onDismiss, onStartTour }: WelcomeModalProps) {
  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-overlay)] opacity-80" />
        <Dialog.Content aria-label={t(modal.titleKey)} className={CONTENT_CLASSES}>
          <Dialog.Title className="text-[length:var(--text-h4)] font-[var(--font-weight-semibold)] text-[var(--color-text-default)]">
            {t(modal.titleKey)}
          </Dialog.Title>
          <Dialog.Description className="mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]">
            {t(modal.bodyKey)}
          </Dialog.Description>
          <div className="mt-[var(--space-4)] flex justify-end gap-[var(--space-2)]">
            {modal.ctas.map((cta) =>
              cta.kind === "tour" ? (
                <Button
                  key={cta.tourId}
                  type="button"
                  variant="primary"
                  onClick={() => {
                    onStartTour(cta.tourId);
                    onDismiss();
                  }}
                >
                  {t("onboarding.cta.take-a-tour")}
                </Button>
              ) : (
                <Button key={cta.labelKey} type="button" variant="secondary" onClick={onDismiss}>
                  {t(cta.labelKey)}
                </Button>
              ),
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
