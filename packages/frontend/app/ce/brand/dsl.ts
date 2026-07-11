export type AssertionType = "regex" | "forbidden-term" | "max-length";

export const ASSERTION_TYPES: AssertionType[] = ["regex", "forbidden-term", "max-length"];

/** ponytail: minimal client-side encoding for VoiceRule's `assertion` field
 * -- TASK-003's shape only requires presence + `xsd:string` (Build owns
 * real evaluation at M2; CE deliberately builds no interpreter, see
 * TASK-003's Implementation Hints). This gives the task brief's type-select
 * + value UI something to compose/parse into that single string
 * ("<type>:<value>") without CE ever needing to understand it.
 */
export function composeAssertion(type: AssertionType, value: string): string {
  return `${type}:${value}`;
}

export function parseAssertion(assertion: string): { type: AssertionType; value: string } {
  const separatorIndex = assertion.indexOf(":");
  const prefix = separatorIndex === -1 ? assertion : assertion.slice(0, separatorIndex);
  const isKnownType = (ASSERTION_TYPES as string[]).includes(prefix);
  return {
    type: isKnownType ? (prefix as AssertionType) : "regex",
    value: isKnownType ? assertion.slice(separatorIndex + 1) : assertion,
  };
}
