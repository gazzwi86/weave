import { hasKey, isValidKeyFormat } from "../content/i18n";

/**
 * AC-003-06: every user-facing string field is an i18n key, never a literal.
 * A literal sentence fails the key-format regex (whitespace/punctuation) and
 * a typo'd key fails the catalogue lookup -- either is a config-lint failure.
 */
export function checkKeysAreRegistered(keys: string[]): string[] {
  const errors: string[] = [];
  for (const key of keys) {
    if (!isValidKeyFormat(key)) {
      errors.push(`"${key}" is not a valid i18n key (looks like a literal string)`);
      continue;
    }
    if (!hasKey(key)) {
      errors.push(`i18n key "${key}" has no "en" catalogue entry`);
    }
  }
  return errors;
}
