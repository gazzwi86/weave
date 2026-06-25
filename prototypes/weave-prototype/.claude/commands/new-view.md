---
description: Scaffold a new frontend tab/view — wiring guide for App.tsx, queries, api client
allowed-tools: Read, Edit, Bash
---

Scaffold a new tab and view in the Weave frontend. This command is a guide — it does NOT generate code automatically. It prompts you through each wiring step.

## Arguments

`$ARGUMENTS` — the name of the new view/tab (e.g. `Timeline`, `Flows`). If not provided, ask the user.

## Steps

All paths are relative to `frontend/src/`.

### 1. Create the view file

Create `views/<Name>View.tsx` with this minimal structure:

```tsx
import type { FC } from 'react';

interface Props {
  projectId: string;
}

const <Name>View: FC<Props> = ({ projectId }) => {
  // TODO: replace with real data hook
  return <div className="view-placeholder"><Name> view — {projectId}</div>;
};

export default <Name>View;
```

Props must include `projectId: string` — all views receive it from `App.tsx`.

### 2. Add a data query (if needed)

In `hooks/queries.ts`:
- Add a `queryKeys.<name>` entry following the `graph`/`glossary` pattern.
- Add a `use<Name>` hook calling `api.<method>`.

In `lib/api.ts`:
- Add the fetch function calling the correct `GET /api/...` endpoint.

In `types.ts`:
- Add any new response types.

### 3. Wire into App.tsx

Open `App.tsx` and make three changes:

**a) Lazy-import the view** (after the existing lazy imports):
```tsx
const <Name>View = lazy(() => import('./views/<Name>View'));
```

**b) Add to TABS** (the `as const` tuple):
```tsx
const TABS = ['Explore', 'Model', 'Objects', 'Glossary', 'Inventory', 'Rules', '<Name>'] as const;
```

**c) Add a case in ActiveView's switch**:
```tsx
case '<Name>':
  return <<Name>View projectId={projectId} />;
```

### 4. Write a test

Create `views/<Name>View.test.tsx` covering at minimum:
- Renders without crashing (with a mocked `QueryClientProvider`).
- Shows a loading state when data is pending.

### 5. Verify

```bash
cd /Users/gareth/Sites/Weave/frontend && npm run typecheck && npm run test
```

Both must pass before committing.
