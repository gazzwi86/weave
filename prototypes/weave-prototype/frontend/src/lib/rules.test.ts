import { describe, expect, it } from 'vitest';
import { groupRules, humanizeKind } from './rules';
import type { Rule } from '../types';

const rule = (over: Partial<Rule>): Rule => ({
  id: 'x',
  category: 'Cat',
  relationship: 'rel',
  object_kind: 'Thing',
  object_kind_curie: 'weave:Thing',
  severity: 'Violation',
  message: null,
  ...over,
});

describe('humanizeKind', () => {
  it('splits PascalCase into words', () => {
    expect(humanizeKind('BusinessDomain')).toBe('Business Domain');
    expect(humanizeKind('BusinessCapability')).toBe('Business Capability');
  });

  it('leaves single words untouched', () => {
    expect(humanizeKind('Concept')).toBe('Concept');
  });
});

describe('groupRules', () => {
  it('groups by category, preserving first-seen order and membership', () => {
    const rules = [
      rule({ id: 'a', category: 'A' }),
      rule({ id: 'b', category: 'B' }),
      rule({ id: 'c', category: 'A' }),
    ];
    const groups = groupRules(rules);
    expect(groups.map(([c]) => c)).toEqual(['A', 'B']);
    expect(groups[0][1].map((r) => r.id)).toEqual(['a', 'c']);
  });

  it('returns an empty list for no rules', () => {
    expect(groupRules([])).toEqual([]);
  });
});
