import { en } from "./i18n/en";

/**
 * i18n key convention (packages/shared-local -- no existing frontend convention
 * to conflict with; see docs/specs/weave/engines/onboarding/decisions/ADR-009.md).
 * Dot-namespaced, lowercase, hyphen-word segments: `onboarding.tour.ce-overview.step1.title`.
 */
const KEY_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)+$/;

export function isValidKeyFormat(key: string): boolean {
  return KEY_FORMAT.test(key);
}

export function resolveKey(key: string): string {
  const value = en[key];
  if (value === undefined) {
    throw new Error(`onboarding i18n: missing "en" catalogue entry for key "${key}"`);
  }
  return value;
}

export function hasKey(key: string): boolean {
  return key in en;
}
