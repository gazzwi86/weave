# TypeScript / JavaScript — tooling overlay

> Python tooling: see [`tooling-py.md`](tooling-py.md).

Package manager: **npm** (default for JS/TS). pnpm / yarn permitted per brief.
Node target: **Node 22 LTS** (Active LTS since October 2024).

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
 * Resolves the display label for a graph entity, falling back to the IRI fragment.
 *
 * @param entity   The entity node returned by the SPARQL query.
 * @param locale   BCP-47 language tag to prefer (e.g. "en").
 * @returns        The preferred label string, never empty.
 */
export function resolveLabel(entity: EntityNode, locale: string): string { /* ... */ }
```

Public APIs require a TSDoc block. Internal helpers may omit them if the
function body is self-evident.
