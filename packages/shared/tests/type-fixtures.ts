/**
 * AC-003-01, compile-error half: an unknown anchor id must be a TypeScript
 * error, not just a runtime zod failure. `tsc --noEmit` (the `typecheck`
 * script/CI gate) fails if the `@ts-expect-error` below does NOT see an
 * error -- so this file is itself the test; nothing imports it at runtime.
 */
import type { TourStep } from "../onboarding/content/schema";

const badStep: TourStep = {
  // @ts-expect-error -- "not-a-real-anchor" is not a registry key (AC-003-01).
  anchorId: "not-a-real-anchor",
  titleKey: "x.title",
  bodyKey: "x.body",
};

export const _typeFixtureBadStep = badStep;
