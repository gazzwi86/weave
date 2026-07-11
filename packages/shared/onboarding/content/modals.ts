import { WelcomeModalSchema, type WelcomeModal } from "./schema";

const constitution: WelcomeModal = {
  modalId: "welcome-constitution",
  area: "constitution",
  titleKey: "onboarding.modal.constitution.title",
  bodyKey: "onboarding.modal.constitution.body",
  ctas: [{ kind: "tour", tourId: "ce-overview" }],
};

const explorer: WelcomeModal = {
  modalId: "welcome-explorer",
  area: "explorer",
  titleKey: "onboarding.modal.explorer.title",
  bodyKey: "onboarding.modal.explorer.body",
  ctas: [{ kind: "tour", tourId: "ge-canvas" }],
};

/** No-tour area (Compliance) -- only "Explore freely" / "Read the guide" CTAs (AC-003-02). */
const compliance: WelcomeModal = {
  modalId: "welcome-compliance",
  area: "compliance",
  titleKey: "onboarding.modal.compliance.title",
  bodyKey: "onboarding.modal.compliance.body",
  ctas: [{ kind: "explore-freely", labelKey: "onboarding.cta.explore-freely" }],
};

/** No-tour area (Settings) -- only "Explore freely" / "Read the guide" CTAs (AC-003-02). */
const settings: WelcomeModal = {
  modalId: "welcome-settings",
  area: "settings",
  titleKey: "onboarding.modal.settings.title",
  bodyKey: "onboarding.modal.settings.body",
  ctas: [{ kind: "read-the-guide", labelKey: "onboarding.cta.read-the-guide" }],
};

export const WELCOME_MODALS: WelcomeModal[] = [constitution, explorer, compliance, settings].map((m) =>
  WelcomeModalSchema.parse(m),
);
