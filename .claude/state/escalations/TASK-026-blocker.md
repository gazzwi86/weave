# TASK-026 blocker note — tenant member directory does not exist

## Gap
Brief's Implementation Hints assume:
- "Author display name: ... resolve display names from the tenant member list
  already available to the SPA shell"
- "Share picker lists tenant members (PLAT-SETTINGS-1-backed member list from
  the shell); eligibility is SERVER-decided"

Checked exhaustively (backend `routers/tenancy.py`, `routers/identity.py`,
frontend `lib/`, `app/settings/`, `app/build/.../contributors-tab.tsx`): there
is **no GET list-members endpoint** anywhere (only `POST/DELETE
/workspaces/{id}/members` — invite/revoke, no listing), and **no frontend
member-list client**. `CommentOut.author` / share recipients are raw
`principal.principal_iri` strings server-side; nothing resolves them to
display names.

## Options
1. Build a members-list backend endpoint + frontend client now — new
   cross-task backend scope, not in TASK-026's API Contracts section, no
   migration slot reserved for it, touches `tenancy.py` which this task
   brief never names. Violates "no speculative cross-task UI" / HARD RULES.
2. Scope-respecting minimum (chosen): freeform recipient entry (text field,
   comma/enter-add chips of email-like strings) for the AC-5 share picker
   instead of a tenant-member picklist — eligibility still server-decided
   (share endpoint accepts/rejects), UI just doesn't pre-populate from a
   directory that doesn't exist. For AC-6 comment author display, derive a
   short display token from the principal IRI (local-part after the last
   `/` or `#`) rather than rendering the raw IRI verbatim — closest
   available approximation without inventing a directory lookup.
3. Full stop and wait for a human-added members-list task.

## Recommendation
Option 2 — ships all 8 ACs today, is honestly short of the brief's *hinted*
UX (a real picklist), and is trivially upgradable later: swap the freeform
input for a picklist once a members-list endpoint exists, no data-shape
change needed since the share request already just takes `recipients:
string[]`.

Proceeding with option 2, flagged in the task summary as a documented
deviation (same pattern as TASK-025's `test_workspace_switch_e2e.py`
precedent).
