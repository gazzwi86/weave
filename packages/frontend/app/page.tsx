import { FeatureGrid, HowItWorks } from "@/components/marketing/features";
import { Hero, MarketingHeader } from "@/components/marketing/hero";
import { FinalCta, MarketingFooter, Pricing } from "@/components/marketing/pricing-footer";

/** Public marketing index (IA §6) — the only page an anonymous visitor sees
 * besides /auth/login. App chrome is suppressed via PUBLIC_PATHS. */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <FeatureGrid />
        <Pricing />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
