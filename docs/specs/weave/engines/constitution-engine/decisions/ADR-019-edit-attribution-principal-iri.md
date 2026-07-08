---
type: ADR
title: "ADR-019: Human edit attribution via PLAT-IDENTITY-1 principal IRI (OQ-11)"
description: "CE-WRITE-1 actor for canvas edits is the canonical principal IRI read from the
  JWT principal_iri claim (minted by PLAT-IDENTITY-1 at first login) — never the bare Cognito sub."
tags: [graph-explorer, adr, oq-11, provenance, identity]
status: Accepted
timestamp: 2026-07-08T00:00:00Z
resource: docs/specs/weave/engines/constitution-engine/decisions/ADR-019-edit-attribution-principal-iri.md
date: 2026-07-08
entity: constitution-engine
---

# ADR-019: Human edit attribution via PLAT-IDENTITY-1 principal IRI (OQ-11)

## Status

Accepted *(approved 2026-07-08; identity surface confirmed — Platform M1 PLAT-TASK-004 AC-1
already mints the human principal and embeds it in the JWT; contracts.md PLAT-IDENTITY-1
retitled "Principal registry (human + agent)")*

## Context

M2 visual editing (E5, FR-019–022) makes OQ-11 load-bearing: every `POST /api/operations/apply`
(CE-WRITE-1) carries an `actor` IRI which CE writes into PROV-O and the PLAT-AUDIT-1 entry.
The PRD (E5-S3) says "actor = editing user's Cognito identity", but every other actor field in
the program (CE-EVENT-1 `actor`, PLAT-AUDIT-1 `actor_principal_iri`, agent writes) uses a
canonical principal IRI. A bare Cognito `sub` in PROV-O would leak IdP-specific identifiers
into the semantic layer and fork attribution conventions between human and agent writers.

The surface already exists: Platform M1 (PLAT-TASK-004 AC-1, done) mints the human principal
IRI `urn:weave:principal:user:{cognito_sub}` at first Cognito login, stores it in Aurora, and
embeds it in the **JWT `principal_iri` claim** (PLAT-IDENTITY-1 — principal registry,
human + agent).

## Decision

- For every canvas-initiated CE-WRITE-1 call, GE sends as `actor` the canonical principal IRI
  **read from the `principal_iri` claim of the Cognito JWT** the proxy already receives and
  validates. No separate resolver call; `GET /api/principals/{iri}` exists for the full record
  but attribution never needs it.
- **Server-side only (spoof guard):** the proxy sets `actor` exclusively from the validated
  JWT claim; any client-supplied `actor` field in the request body is rejected (mirrors the
  Platform `/api/operations/apply` proxy behaviour).
- **Claim verbatim:** the IRI is used exactly as carried in the claim — GE never re-derives it
  by string-building from `sub`; the IRI scheme stays Platform-owned.
- The bare Cognito `sub` is never sent as `actor`.
- The JWT itself still accompanies the request unchanged — CE-WRITE-1's server-side authz
  boundary (JWT + role claim) is untouched; this ADR concerns attribution only.
- A missing `principal_iri` claim fails the edit loud (edit rejected with notice) — an edit is
  never committed with missing or fabricated attribution.

## Consequences

- Human and agent writes are attributionally uniform across PROV-O, CE-EVENT-1, and
  PLAT-AUDIT-1 — audit cross-referencing needs no special-casing for canvas edits.
- Zero new runtime dependencies: attribution is a claim read on a token GE already validates
  (stub JWTs in tests carry the claim — Law F unaffected).
- E5-S3's PRD wording "Cognito identity" is satisfied in substance (the principal IRI is
  minted from and unique to the Cognito identity); the tech spec supersedes the letter —
  noted in the M2 delta.

## Alternatives Considered

- **Send bare Cognito `sub` as actor.** Rejected: leaks IdP detail into the semantic layer,
  breaks uniformity with every other actor field, and couples PROV-O history to the identity
  provider.
- **Per-edit resolver call to PLAT-IDENTITY-1.** Rejected: unnecessary — the claim is already
  in the JWT (PLAT-TASK-004 AC-1); a network hop per edit buys nothing.
- **GE mints its own human-principal IRI scheme.** Rejected: forks identity authority;
  PLAT-IDENTITY-1 is the single registry (contracts.md §2).
- **Defer attribution to CE (CE reads the claim itself).** Workable, but the CE-WRITE-1
  request shape already has the caller supply `actor` (as agent writers do); changing that is
  a contract amendment for no gain.
