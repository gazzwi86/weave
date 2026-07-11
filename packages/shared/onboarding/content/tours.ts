import { TourSchema, type Tour } from "./schema";

const ceOverview: Tour = {
  tourId: "ce-overview",
  area: "constitution",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m1",
  steps: [
    { anchorId: "ce.overview", titleKey: "onboarding.tour.ce-overview.step1.title", bodyKey: "onboarding.tour.ce-overview.step1.body" },
    { anchorId: "ce.glossary", titleKey: "onboarding.tour.ce-overview.step2.title", bodyKey: "onboarding.tour.ce-overview.step2.body" },
    { anchorId: "ce.query", titleKey: "onboarding.tour.ce-overview.step3.title", bodyKey: "onboarding.tour.ce-overview.step3.body" },
    { anchorId: "ce.rules", titleKey: "onboarding.tour.ce-overview.step4.title", bodyKey: "onboarding.tour.ce-overview.step4.body" },
  ],
};

const geCanvas: Tour = {
  tourId: "ge-canvas",
  area: "explorer",
  paths: ["business", "technical", "compliance", "admin"],
  phase: "m1",
  steps: [
    { anchorId: "ge.canvas", titleKey: "onboarding.tour.ge-canvas.step1.title", bodyKey: "onboarding.tour.ge-canvas.step1.body" },
    { anchorId: "ge.canvas.spotlight-control", titleKey: "onboarding.tour.ge-canvas.step2.title", bodyKey: "onboarding.tour.ge-canvas.step2.body" },
  ],
};

export const TOURS: Tour[] = [ceOverview, geCanvas].map((t) => TourSchema.parse(t));
