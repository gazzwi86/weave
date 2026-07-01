---
type: Coding Standard
title: "Frontend — Next.js 15 Static Shell + shadcn/ui Client Form (typescript)"
description: "Golden pattern for the Weave SPA: a Server Component renders a static shell at build time (no secret, no per-user fetch) and a 'use client' island fetches its data from the FastAPI API through the shared authenticated client, then renders a shadcn/ui form wired with react-hook-form + zod, fully accessible (labels/aria/data-testid). No secret or business logic ever runs client-side or in a per-request server runtime."
tags: [standards, patterns, frontend, typescript]
timestamp: 2026-07-01
resource: docs/standards/patterns/frontend/nextjs-shadcn-component.md
topic: frontend
stack: typescript
verification: "esbuild 0.28.1 transform-mode syntax check of both tsx blocks via `npx esbuild <tmp>.tsx --bundle=false` (extension-based loader) — PASS 2026-07-01. NOTE: esbuild checks syntax only, NOT types; tsc --strict conformance (no `React.` UMD-global reference, no floating/misused promises, no `process.env` template interpolation) was reasoned by eye, not machine-checked."
---

# Frontend — Next.js 15 Static Shell + shadcn/ui Client Form (typescript)

**Deployment model:** Weave ships as a **single React SPA** — Next.js 15 App Router built with
`output: 'export'` and served as static assets from **CloudFront + S3** (see
`ci/github-actions-ts-nextjs.md` and `infra/terraform-cloudfront-s3-spa.md`). The application API
is the **separate FastAPI backend**; the SPA calls it client-side over HTTPS with the user's
Cognito JWT. There is **no per-request Next.js server runtime** in production, so a page Server
Component is a *build-time* static shell — it must not read secrets and must not fetch per-user
data. (Next.js route handlers, if used at all, are a separate BFF concern — see
`api/nextjs-route-handler.md` — not part of the static S3 bundle.)

## Intent

In the App Router the page is a **Server Component**, but under `output: 'export'` it renders to
**static HTML at build time**: it holds no secret and does no per-user fetch. It is the shell —
layout, headings, and the client island. All interactive, authenticated data lives in the small
`'use client'` child, which fetches from the **FastAPI API through the shared client** (`@/lib/api`,
which attaches the user's Cognito JWT) and renders a shadcn/ui form driven by `react-hook-form` +
a `zod` resolver, with correct labels, `aria-*`, and `data-testid` selectors (the only selector
E2E uses). No static service token, secret, or business rule lives in the browser bundle; the
client posts back through the same API client and lets the FastAPI server enforce the rules.

```tsx
// app/projects/[projectId]/settings/page.tsx  — Server Component (no 'use client')
import { ProjectSettingsForm } from './ProjectSettingsForm';

// Static shell: with `output: 'export'` this renders to static HTML at BUILD time.
// It reads no secret and fetches no per-user data — the client island does that.
export default function ProjectSettingsPage() {
  return (
    <main className="mx-auto max-w-2xl p-6" data-testid="project-settings-page">
      <h1 className="text-2xl font-semibold tracking-tight">Project settings</h1>
      <ProjectSettingsForm />
    </main>
  );
}
```

```tsx
// app/projects/[projectId]/settings/ProjectSettingsForm.tsx  — Client Component
'use client';

import { useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
// Shared, authenticated API client: talks to the FastAPI backend and attaches the user's
// Cognito JWT. Defined once in @/lib/api (e.g. a TanStack Query hook + a typed mutation).
// There is NO static service token and NO process.env interpolation in the browser bundle.
import { useProjectSettings, patchProjectSettings } from '@/lib/api';

const FormSchema = z.object({
  displayName: z.string().min(1, 'Name is required').max(120),
  // Keep the schema's input and output types identical (no `.default()`), so the
  // zodResolver<FormValues> type lines up under strict tsc. Seed via `values` below instead.
  description: z.string().max(2000),
});
type FormValues = z.infer<typeof FormSchema>;

// No explicit return-type annotation: Next/React infer it. Do NOT annotate `React.JSX.Element`
// without importing React — referencing the `React` UMD global inside a module is ts(2686).
export function ProjectSettingsForm() {
  const { projectId } = useParams<{ projectId: string }>();
  // Data comes from the FastAPI API via the shared client hook (client-side fetch, user's JWT).
  const { data, error } = useProjectSettings(projectId);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    // RHF resets the form reactively when the async data arrives — no useEffect needed.
    values: data ? { displayName: data.displayName, description: data.description } : undefined,
  });

  async function onSubmit(values: FormValues): Promise<void> {
    // Client only orchestrates the PATCH; the FastAPI server re-validates and enforces RBAC/SHACL.
    try {
      await patchProjectSettings(projectId, values);
    } catch (err) {
      setError('root', { message: extractMessage(err) }); // surfaced in a role="alert" region below
    }
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-destructive" data-testid="settings-load-error">
        Could not load project settings.
      </p>
    );
  }
  if (!data) {
    return <p data-testid="settings-loading">Loading…</p>;
  }

  return (
    // Wrap the promise-returning handler so the void-returning onSubmit prop is not a
    // no-misused-promises violation under the type-checked lint gate.
    <form
      onSubmit={(e) => void handleSubmit(onSubmit)(e)}
      noValidate
      aria-busy={isSubmitting}
      className="mt-6 space-y-4"
      data-testid="project-settings-form"
    >
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
        <Textarea
          id="description"
          data-testid="settings-description"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errors.description ? 'description-error' : undefined}
          {...register('description')}
        />
        {errors.description ? (
          <p id="description-error" role="alert" className="text-sm text-destructive" data-testid="settings-description-error">
            {errors.description.message}
          </p>
        ) : null}
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

function extractMessage(err: unknown): string {
  // Render only the safe, human-readable message the API client surfaces — never a raw
  // error object, stack, or PII.
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Could not save changes. Please try again.';
}
```

**Why**

- With `output: 'export'` the page Server Component is prerendered to **static HTML at build**;
  there is no per-request server runtime, so it can neither read a secret nor fetch per-user data.
  It is a pure shell that mounts the client island.
- The child is the minimal `'use client'` island — it reads `projectId` from the client route
  (`useParams`), fetches via the shared FastAPI client hook, owns form state via `react-hook-form`,
  and validates via `zodResolver(FormSchema)`, matching the server-side zod/SHACL contract so the
  client and server validate the same shape.
- RHF's `values` option resets the form reactively once the async data resolves — no `useEffect`,
  so `react-hooks/exhaustive-deps` has nothing to flag.
- No explicit `React.JSX.Element` return type: annotating the `React` namespace without importing
  it is **ts(2686)** ("`React` refers to a UMD global … in a module"). Let Next infer, or
  `import type { JSX } from 'react'` and annotate `JSX.Element`.
- Accessibility: every input has a real `<Label htmlFor>`; **both** fields link their error with
  `aria-describedby` + `aria-invalid` and announce it via `role="alert"`; `aria-busy` reflects the
  in-flight submit. This satisfies the WCAG 2.1 AA / axe-zero gate.
- `data-testid` is present on the page, form, each field, each error, and the submit — the only
  selector E2E is allowed to use.

**Security**

- **No static service token in the browser.** Auth is the user's Cognito JWT, attached by the
  shared `@/lib/api` client — never a long-lived `Bearer <static token>` and never a `process.env`
  secret interpolated into a request. (House rule: human → Cognito JWT; machine → IAM role via STS;
  see `rbac-multi-tenancy.md` `PLAT-IDENTITY-1`. A static bearer token is the forbidden shape.)
- The client never trusts itself: `onSubmit` posts through the API client, and the **FastAPI
  server** re-validates and enforces RBAC (403, audited to `PLAT-AUDIT-1`) and SHACL (422).
  Client-side zod is UX, not a control.
- Errors are read through `extractMessage`, which pulls only the safe human-readable `message` —
  never rendering raw error objects, stacks, or PII.
- `noValidate` hands validation to zod/RHF (consistent messaging) rather than the browser.

**Anti-patterns**

- Reading secrets or fetching per-user data in the page Server Component under static export — it
  runs at build time; there is no server to hold a secret or a per-request session.
- Embedding a static service token (`Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`) or any
  `process.env` value in a request — that is a forbidden machine-auth shape and (in a client
  bundle) leaks; also fails `restrict-template-expressions` on `string | undefined`.
- Annotating `: React.JSX.Element` / `: Promise<React.JSX.Element>` without importing React —
  ts(2686) UMD-global-in-module; drop the annotation or `import type { JSX } from 'react'`.
- `onSubmit={handleSubmit(onSubmit)}` — the promise-returning handler trips
  `@typescript-eslint/no-misused-promises`; wrap as `onSubmit={(e) => void handleSubmit(onSubmit)(e)}`.
- Placeholder text as the only label, colour-only error signalling, or wiring aria on one field but
  not the other — fails WCAG 2.1 AA.
- Selecting elements by class/tag/text in E2E instead of `data-testid`.
- Treating client-side zod as the authorisation/validation boundary; the FastAPI server must re-check.
