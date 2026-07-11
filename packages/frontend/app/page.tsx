import { MARKETING_SECTIONS } from "@/components/marketing/sections";
import { LandingPageTemplate } from "@/components/templates/landing-page";

/** Public marketing index (IA §6) — the only page an anonymous visitor sees
 * besides /auth/login. App chrome is suppressed via PUBLIC_PATHS. Thin
 * binder onto the design-system `landing-page` template (R13) -- no direct
 * marketing-molecule JSX lives here. */
export default function Home() {
  return <LandingPageTemplate sections={MARKETING_SECTIONS} />;
}
