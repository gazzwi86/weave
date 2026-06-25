// Pure helpers for the Rules view. Kept separate from the component so they're
// trivially unit-testable.

import type { Rule } from '../types';

/** Split a PascalCase kind into words: "BusinessDomain" -> "Business Domain". */
export function humanizeKind(kind: string): string {
  return kind.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Group rules by their category, preserving first-seen order. */
export function groupRules(rules: Rule[]): [string, Rule[]][] {
  const groups = new Map<string, Rule[]>();
  for (const rule of rules) {
    const list = groups.get(rule.category) ?? [];
    list.push(rule);
    groups.set(rule.category, list);
  }
  return [...groups.entries()];
}
