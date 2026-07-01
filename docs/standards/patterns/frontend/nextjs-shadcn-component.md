---
type: Coding Standard
title: "Frontend — Next.js 15 Server Component + shadcn/ui Client Form (typescript)"
description: "Golden pattern for the server/client boundary: an async Server Component fetches on the server and passes plain data to a 'use client' child that renders a shadcn/ui form wired with react-hook-form + zod, fully accessible (labels/aria/data-testid), with no secret or business logic leaking to the client."
tags: [standards, patterns, frontend, typescript]
timestamp: 2026-07-01
resource: docs/standards/patterns/frontend/nextjs-shadcn-component.md
topic: frontend
stack: typescript
verification: "esbuild 0.28.1 transform-mode syntax check of both tsx blocks via `npx esbuild <tmp>.tsx --bundle=false` (extension-based loader) — PASS 2026-07-01"
---

# Frontend — Next.js 15 Server Component + shadcn/ui Client Form (typescript)

## Intent

The default in the App Router is a **Server Component**: it runs only on the server, can
read secrets and hit services directly, and never ships its code to the browser. It fetches
data and passes **plain serialisable props** to a small `'use client'` child. The client
child owns interactivity only — here a shadcn/ui form driven by `react-hook-form` + a `zod`
resolver, with correct labels, `aria-*`, and `data-testid` selectors (the only selector E2E
uses). No secret, service handle, or business rule crosses the boundary; the client posts to
the route handler and lets the server enforce the rules.

```tsx
// app/projects/[projectId]/settings/page.tsx  — Server Component (no 'use client')
import { notFound } from 'next/navigation';
import { ProjectSettingsForm } from './ProjectSettingsForm';

// Plain, serialisable shape crossing the server -> client boundary.
export interface ProjectSettings {
  projectId: string;
  displayName: string;
  description: string;
}

async function loadSettings(projectId: string): Promise<ProjectSettings | null> {
  // Runs on the server: may read Secrets Manager creds, hit Aurora/SPARQL directly.
  // Secrets stay here — only the plain object below is serialised to the client.
  const res = await fetch(`${process.env.INTERNAL_API_URL}/api/v1/projects/${projectId}/settings`, {
    headers: { authorization: `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}` },
    cache: 'no-store',
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('settings_fetch_failed');
  return (await res.json()) as ProjectSettings;
}

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>; // Next.js 15: params is async
}): Promise<React.JSX.Element> {
  const { projectId } = await params;
  const settings = await loadSettings(projectId);
  if (!settings) notFound();

  // Pass data down — never pass functions that close over secrets or a service client.
  return (
    <main className="mx-auto max-w-2xl p-6" data-testid="project-settings-page">
      <h1 className="text-2xl font-semibold tracking-tight">Project settings</h1>
      <ProjectSettingsForm initial={settings} />
    </main>
  );
}
```

```tsx
// app/projects/[projectId]/settings/ProjectSettingsForm.tsx  — Client Component
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { ProjectSettings } from './page';

const FormSchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(120),
  // Keep the schema's input and output types identical (no `.default()`), so the
  // zodResolver<FormValues> type lines up under strict tsc. Seed the value via
  // defaultValues below instead.
  description: z.string().max(2000),
});
type FormValues = z.infer<typeof FormSchema>;

interface ProjectSettingsFormProps {
  initial: ProjectSettings;
}

export function ProjectSettingsForm({ initial }: ProjectSettingsFormProps): React.JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { displayName: initial.displayName, description: initial.description },
  });

  async function onSubmit(values: FormValues): Promise<void> {
    // Client only orchestrates the POST; the server re-validates and enforces RBAC/SHACL.
    const res = await fetch(`/api/v1/projects/${initial.projectId}/settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const message = extractMessage(body);
      setError('root', { message }); // surfaced in a role="alert" region below
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 space-y-4" data-testid="project-settings-form">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          data-testid="settings-display-name"
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={errors.displayName ? 'displayName-error' : undefined}
          {...register('displayName')}
        />
        {errors.displayName ? (
          <p id="displayName-error" role="alert" className="text-sm text-destructive" data-testid="settings-display-name-error">
            {errors.displayName.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" data-testid="settings-description" {...register('description')} />
      </div>

      {errors.root ? (
        <p role="alert" className="text-sm text-destructive" data-testid="settings-form-error">
          {errors.root.message}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} data-testid="settings-submit">
        {isSubmitting ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

function extractMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const err = (body as { error?: { message?: unknown } }).error;
    if (err && typeof err.message === 'string') return err.message;
  }
  return 'Could not save changes. Please try again.';
}
```

**Why**

- The page is a Server Component (no `'use client'`): its `fetch`, tokens, and env vars never
  reach the browser. Only the plain `ProjectSettings` object is serialised across the boundary.
- The child is the minimal `'use client'` island — it owns form state via `react-hook-form` and
  validation via `zodResolver(FormSchema)`, matching the server-side zod contract so the client
  and server validate the same shape.
- `params` is awaited (Next.js 15 async params). `notFound()` renders the 404 boundary rather
  than a blank page.
- Accessibility: every input has a real `<Label htmlFor>`; error text is linked with
  `aria-describedby` + `aria-invalid` and announced via `role="alert"`; the submit button
  reflects `isSubmitting`. This satisfies the WCAG 2.1 AA / axe-zero gate.
- `data-testid` is present on the page, form, each field, each error, and the submit — the only
  selector E2E is allowed to use.

**Security**

- No secret or service client crosses to the client: the server passes data, not closures over
  `process.env` or a DB handle. `INTERNAL_SERVICE_TOKEN` is read and used only in the Server
  Component.
- The client never trusts itself: `onSubmit` posts to the route handler, and the **server**
  re-validates and enforces RBAC (403) and SHACL (422). Client-side zod is UX, not a control.
- Server error responses are read through `extractMessage`, which pulls only the envelope's
  human-readable `message` — never rendering raw error objects, stacks, or PII.
- `noValidate` hands validation to zod/RHF (consistent messaging) rather than the browser.

**Anti-patterns**

- Marking the page `'use client'` to "make fetch easier" — that ships secrets/logic to the
  browser and defeats RSC.
- Passing a server function or a live service/DB client as a prop to the client child.
- Placeholder text as the only label, or colour-only error signalling — fails WCAG 2.1 AA.
- Selecting elements by class/tag/text in E2E instead of `data-testid`.
- Treating client-side zod as the authorisation/validation boundary; the server must re-check.
- Using the Next.js 14 synchronous `params` shape under Next.js 15.
