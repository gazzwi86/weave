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
| Files (components) | PascalCase | `EntityCard.tsx` |
| Files (utilities) | camelCase | `graphUtils.ts` |
| Files (tests) | Match source + `.test` | `EntityCard.test.tsx` |
| Components | PascalCase | `EntityCard` |
| Functions | camelCase | `resolveLabel` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_GRAPH_URI` |
| Types/Interfaces | PascalCase | `EntityNode` |
| CSS classes | kebab-case | `entity-card` |

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

## TSDoc

All public functions, components, hooks, and types must have a TSDoc block.
Internal helpers may omit if name and types are self-evident.

```typescript
/**
 * Resolves the display label for a graph entity, falling back to the IRI fragment.
 *
 * @param entity - The entity node returned by the SPARQL query.
 * @param locale - BCP-47 language tag to prefer (e.g. "en").
 * @returns The preferred label string, never empty.
 */
export function resolveLabel(entity: EntityNode, locale: string): string {
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

## Python

### Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Modules / packages | `snake_case` | `ontology_store.py` |
| Classes | `PascalCase` | `OntologyStore` |
| Functions / methods | `snake_case` | `validate_shape` |
| Constants | `UPPER_SNAKE_CASE` | `DEFAULT_GRAPH_URI` |
| Type aliases | `PascalCase` | `TripleSet` |
| Private members | leading `_` | `_client` |

### Type hints

Use Python 3.12+ built-in generics — no `from __future__ import annotations` needed:

```python
# Good — 3.12+ syntax
def find_entities(type_uri: str | None = None) -> list[dict[str, str]]:
    ...

# Bad — legacy typing module
from typing import List, Optional
def find_entities(type_uri: Optional[str] = None) -> List[dict]:
    ...
```

All function signatures must be fully typed. Return types are mandatory — never omit.

### Pydantic v2

```python
from pydantic import BaseModel, Field, model_validator

class EntityCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    type_uri: str = Field(..., alias="typeUri")
    description: str | None = None

    model_config = ConfigDict(populate_by_name=True)

    @model_validator(mode="after")
    def label_is_not_blank(self) -> "EntityCreate":
        if not self.label.strip():
            raise ValueError("label must not be blank")
        return self
```

- Use `Field(...)` not `Field(default=...)` for required fields.
- Use `model_config = ConfigDict(...)` not the inner `class Config`.
- Validators use `@model_validator` (v2); avoid `@validator` (v1 compat, deprecated).
- Never use `.dict()` — use `.model_dump()`.

### FastAPI patterns

```python
from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas import EntityCreate, EntityRead
from app.services.entities import EntityService

router = APIRouter(prefix="/entities", tags=["entities"])

@router.post("", response_model=EntityRead, status_code=status.HTTP_201_CREATED)
async def create_entity(
    payload: EntityCreate,
    service: EntityService = Depends(),
) -> EntityRead:
    return await service.create(payload)
```

- Routers live in `app/routers/`; services in `app/services/`.
- Inject dependencies via `Depends()` — never instantiate services inside route handlers.
- Use `status.HTTP_*` constants, not bare integers.
- Return typed response models; the route decorator `response_model` is for OpenAPI docs only.

### Imports (enforced by ruff `I`)

```python
# 1. stdlib
import asyncio
from pathlib import Path

# 2. third-party
import httpx
from fastapi import APIRouter
from rdflib import Graph, URIRef

# 3. internal
from app.ontology.store import OntologyStore
from app.schemas import EntityCreate
```

---
