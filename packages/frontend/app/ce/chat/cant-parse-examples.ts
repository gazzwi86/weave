const EXAMPLE_TEMPLATES = [
  "Try: \"add a process called Invoice Approval\"",
  "Try: \"link Invoice Approval to the Finance capability\"",
  "Try: \"rename the Approve step to Review\"",
];

/** AC-8/F-D12: names the specific ambiguity (the backend's own message,
 * already specific) and appends 2-3 example phrasings; if the exact same
 * reply already fired this session, prefixes an alternate lead-in so the
 * user never sees the identical generic reply twice in a row.
 */
export function buildCantParseReply(reason: string, lastReply: string | null): string {
  const withExamples = `${reason}\n\n${EXAMPLE_TEMPLATES.join("\n")}`;
  if (lastReply === null) return withExamples;
  return `Still not sure -- ${withExamples}`;
}
