import type { LandingPageSection } from "@/components/templates/landing-page";

import { FeatureGrid, HowItWorks } from "./features";
import { Hero, MarketingHeader } from "./hero";
import { FinalCta, MarketingFooter, Pricing } from "./pricing-footer";
import { ScreenshotBand } from "./screenshot-band";
import { SocialProof } from "./social-proof";

/** Marketing index content bound into `LandingPageTemplate`'s fixed IA order
 * (`poc-ia-proposal.md` §6, R13). The only place marketing molecules are
 * composed -- `app/page.tsx` binds this data, it does not import them. */
export const MARKETING_SECTIONS: LandingPageSection[] = [
  { kind: "header", content: <MarketingHeader /> },
  { kind: "hero", content: <Hero /> },
  { kind: "social-proof", content: <SocialProof /> },
  { kind: "how-it-works", content: <HowItWorks /> },
  { kind: "feature-grid", content: <FeatureGrid /> },
  { kind: "screenshot-band", content: <ScreenshotBand /> },
  { kind: "pricing", content: <Pricing /> },
  { kind: "final-cta", content: <FinalCta /> },
  { kind: "footer", content: <MarketingFooter /> },
];
