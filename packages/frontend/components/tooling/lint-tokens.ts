import type { Rule } from "eslint";

export interface TokenViolation {
  line: number;
  message: string;
}

/** Raw hex/px/ms literals -- the only three shapes a token value can leak
 * out as in a Tailwind arbitrary-value bracket (colour/spacing/duration). */
const RAW_LITERAL_PATTERNS: RegExp[] = [/#[0-9a-fA-F]{3,8}\b/, /\b\d+px\b/, /\b\d+ms\b/];

/** The token source itself declares the raw values every component reads
 * back out as var(--token) -- exempt, not a violation. */
function isTokenSource(filePath: string): boolean {
  return /globals\.css$|tokens\.css$|tokens\.ts$/.test(filePath);
}

/** Governs components/** at any depth, absolute or repo-relative path. */
function isUnderComponents(filePath: string): boolean {
  const normalized = filePath.split("\\").join("/");
  return normalized.includes("/components/") || normalized.startsWith("components/");
}

/**
 * Design-token conformance (docs/standards/design/tokens.md, Law 20): every
 * colour/spacing/duration value in components/** must be a CSS custom
 * property (`var(--token)`), never a raw hex/px/ms literal.
 */
export function checkTokenConformance(filePath: string, fileContents: string): TokenViolation[] {
  if (isTokenSource(filePath) || !isUnderComponents(filePath)) return [];

  const violations: TokenViolation[] = [];
  fileContents.split("\n").forEach((line, index) => {
    const match = RAW_LITERAL_PATTERNS.map((pattern) => line.match(pattern)).find(Boolean);
    if (match) {
      violations.push({
        line: index + 1,
        message: `raw_token_value: literal "${match[0]}" -- use a var(--token) instead`,
      });
    }
  });
  return violations;
}

export const tokenConformanceRule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: { description: "Ban raw hex/px/ms literals in components/** -- use design tokens." },
    schema: [],
  },
  create(context) {
    return {
      Program(node) {
        const violations = checkTokenConformance(context.filename, context.sourceCode.getText());
        for (const violation of violations) {
          context.report({ node, message: violation.message, loc: { line: violation.line, column: 0 } });
        }
      },
    };
  },
};
