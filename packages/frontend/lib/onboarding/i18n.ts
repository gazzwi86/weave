// ONB-TASK-007 AC-007-07: tour copy resolves exclusively from the shared
// `en` catalogue (i18n keys, no literal strings) -- no i18n library is wired
// into this frontend yet (grep confirms), so resolution is the flat lookup
// the catalogue is already shaped for (ADR-006).
import { en } from "../../../shared/onboarding/content/i18n/en";

/** Resolves an onboarding i18n key; falls back to the key itself (never
 * throws) so a missing catalogue entry degrades visibly instead of crashing
 * a tour mid-flight. */
export function t(key: string): string {
  return en[key] ?? key;
}
