# Code Style Standards

## General Principles

- Write code for humans first, machines second
- Prefer explicit over implicit
- Keep functions small and focused (max 50 lines)
- Keep files focused (max 300 lines)
- Use descriptive names -- code should read like prose

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (components) | PascalCase | `GameBoard.tsx` |
| Files (utilities) | camelCase | `numberUtils.ts` |
| Files (tests) | Match source + `.test` | `GameBoard.test.tsx` |
| Components | PascalCase | `GameBoard` |
| Functions | camelCase | `calculateScore` |
| Constants | UPPER_SNAKE_CASE | `MAX_NUMBERS` |
| Types/Interfaces | PascalCase | `GameState` |
| CSS classes | kebab-case | `game-board` |

## TypeScript

- Strict mode enabled (`"strict": true`)
- Prefer `interface` over `type` for object shapes
- Use `const` by default, `let` only when reassignment needed
- Never use `any` -- use `unknown` and narrow
- Export types alongside their implementations

## React

- Functional components only
- Props interface defined above component
- Destructure props in function signature
- Custom hooks for shared logic (`use` prefix)
- Collocate tests with source files in `__tests__/`

## JSDoc

All public functions, components, hooks, and types must have JSDoc:

```typescript
/**
 * Calculates the player's score based on collected numbers.
 * @param numbers - Array of collected number values
 * @param multiplier - Score multiplier from current game phase
 * @returns The calculated score
 */
export function calculateScore(numbers: number[], multiplier: number): number {
  // ...
}
```

## File Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # Shared UI components
│   ├── ui/                # Base UI primitives
│   └── features/          # Feature-specific components
├── hooks/                  # Custom React hooks
├── lib/                    # Utilities, helpers, services
├── types/                  # Shared TypeScript types
└── styles/                 # Global styles
```

## Imports

Order (enforced by ESLint):
1. React/Next.js
2. External packages
3. Internal modules (`@/`)
4. Relative imports
5. Type imports

---
*Opinionated defaults from Weave. Override in docs/standards/code-style.md*
