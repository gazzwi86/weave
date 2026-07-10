import type { Rule } from "eslint";

export interface TokenViolation {
  line: number;
  message: string;
}

// ponytail: stub for RED -- always reports no violations. Filled in next commit.
export function checkTokenConformance(_filePath: string, _fileContents: string): TokenViolation[] {
  return [];
}

export const tokenConformanceRule: Rule.RuleModule = {
  meta: { type: "problem", docs: { description: "stub" }, schema: [] },
  create() {
    return {};
  },
};
