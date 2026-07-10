import type { Rule } from "eslint";

export interface ImportViolation {
  message: string;
}

// ponytail: stubs for RED -- always report no violations. Filled in next commit.
export function checkDumbComponent(_filePath: string, _imports: string[]): ImportViolation[] {
  return [];
}

export function checkAppLayerBoundary(_filePath: string, _imports: string[]): ImportViolation[] {
  return [];
}

const stubRule: Rule.RuleModule = {
  meta: { type: "problem", docs: { description: "stub" }, schema: [] },
  create() {
    return {};
  },
};

export const dumbComponentRule: Rule.RuleModule = stubRule;
export const appLayerBoundaryRule: Rule.RuleModule = stubRule;
