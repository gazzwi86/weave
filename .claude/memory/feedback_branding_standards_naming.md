---
name: Branding & standards naming
description: Nav/page is "Branding & standards" (not "Brand & voice"); "voice rules" renamed
  "brand rules"; both tabs need full CRUD. Supersedes spec's "Brand & voice" label.
type: feedback
created: 2026-07-17
---

The Constitution nav item and page formerly "Brand & voice" is named **"Branding & standards"**;
"voice rules" are called **"brand rules"** everywhere in UI copy. Both brand rules and standards
must have create/edit/delete UI (drawer pattern with danger Delete). Writes go through CE-WRITE-1
(`/api/operations/apply`); CE-BRAND-1 stays a read-only projection.

**Why:** User ruling 2026-07-17 — the page covers branding plus company standards, so the old
label was wrong; spec docs still say "Brand & voice" (`constitution-engine.md` §content areas) and
are superseded on naming only, not on contract semantics.

**How to apply:** Any UI work touching this area uses the new names (nav, titles, breadcrumbs,
empty states). Mock reference: `docs/design/mocks/refit-mock.html` sub-brand screen.
