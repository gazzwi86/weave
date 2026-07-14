import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";

import { WelcomeModal } from "../welcome-modal";
import type { WelcomeModal as WelcomeModalConfig } from "../../../../shared/onboarding/content/schema";

const complianceModal: WelcomeModalConfig = {
  modalId: "welcome-compliance",
  area: "compliance",
  titleKey: "onboarding.modal.compliance.title",
  bodyKey: "onboarding.modal.compliance.body",
  ctas: [{ kind: "explore-freely", labelKey: "onboarding.cta.explore-freely" }],
};

const constitutionModal: WelcomeModalConfig = {
  modalId: "welcome-constitution",
  area: "constitution",
  titleKey: "onboarding.modal.constitution.title",
  bodyKey: "onboarding.modal.constitution.body",
  ctas: [{ kind: "tour", tourId: "ce-overview" }],
};

const onDismiss = vi.fn();
const onStartTour = vi.fn();

describe("WelcomeModal", () => {
  beforeEach(() => {
    onDismiss.mockClear();
    onStartTour.mockClear();
  });

  it("renders title, body, and a tour CTA (AC-008-04/05)", () => {
    render(<WelcomeModal modal={constitutionModal} onDismiss={onDismiss} onStartTour={onStartTour} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/knowledge graph lives/i)).toBeInTheDocument();
  });

  it("tour CTA starts the tour and dismisses (AC-008-04)", () => {
    render(<WelcomeModal modal={constitutionModal} onDismiss={onDismiss} onStartTour={onStartTour} />);
    fireEvent.click(screen.getByRole("button", { name: /take a tour/i }));
    expect(onStartTour).toHaveBeenCalledWith("ce-overview");
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("no-tour area renders only its configured CTA kind, no dead tour button (AC-008-05)", () => {
    render(<WelcomeModal modal={complianceModal} onDismiss={onDismiss} onStartTour={onStartTour} />);
    expect(screen.queryByRole("button", { name: /take a tour/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /explore freely/i })).toBeInTheDocument();
  });

  it("explore-freely CTA just dismisses (AC-008-05)", () => {
    render(<WelcomeModal modal={complianceModal} onDismiss={onDismiss} onStartTour={onStartTour} />);
    fireEvent.click(screen.getByRole("button", { name: /explore freely/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onStartTour).not.toHaveBeenCalled();
  });

  it("passes the axe zero-violations gate (AC-008-07)", async () => {
    render(<WelcomeModal modal={constitutionModal} onDismiss={onDismiss} onStartTour={onStartTour} />);
    const results = await axe(document.body);
    expect(results.violations).toHaveLength(0);
  });
});
