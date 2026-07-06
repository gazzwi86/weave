const TRAILING_LANG_TAG = /@[a-zA-Z]{2,3}(-[a-zA-Z]+)?$/;

/** Strips a trailing RDF language tag (e.g. `"Label"@en`, `"Label"@en-US`)
 * from a literal value. Never touches a non-trailing `@` (e.g. an email
 * address embedded in a comment). */
export function stripLangTag(value: string): string {
  return value.replace(TRAILING_LANG_TAG, "");
}
