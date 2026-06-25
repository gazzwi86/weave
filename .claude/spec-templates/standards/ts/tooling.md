# TypeScript / JavaScript — tooling overlay

Package manager: **npm** (default). pnpm / yarn permitted per brief.
Node target: **Node 20 LTS** (Active LTS; switch to Node 22 once Active LTS flips).

## tsconfig (strict)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Formatter

Prettier with `.prettierrc`:

```json
{ "semi": true, "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

## Pre-commit (husky + lint-staged)

```bash
npx husky init
npm i -D husky lint-staged tsc-files
```

`.husky/pre-commit`:
```bash
npx lint-staged
```

`.husky/pre-push`:
```bash
npm test
npm audit --audit-level=high
```

`package.json`:
```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "tsc-files --noEmit", "vitest related --run"]
  }
}
```

## Docstring style (TSDoc)

```ts
/**
 * Calculates the player's score from collected numbers.
 *
 * @param numbers  Values collected during the round.
 * @param bonus    Multiplier from the current phase.
 * @returns        The total score (non-negative).
 */
export function calculateScore(numbers: number[], bonus: number): number { /* ... */ }
```

Public APIs require a TSDoc block. Internal helpers may omit them if the
function body is self-evident.
