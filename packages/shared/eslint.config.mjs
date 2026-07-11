import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**"] },
  ...tseslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    rules: {
      complexity: ["error", 10],
      "sonarjs/cognitive-complexity": ["error", 15],
      "max-lines-per-function": ["warn", { max: 50, skipBlankLines: true, skipComments: true }],
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
      "sonarjs/no-duplicate-string": ["warn", { threshold: 3 }],
      "sonarjs/no-identical-functions": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
);
