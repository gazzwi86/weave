"""TASK-004 AC-004-04: deterministic, tenant-scoped IRI generation for a
(kind, label) pair.

Implementation hint: normalise the label (lowercase, strip punctuation,
collapse/replace whitespace with hyphens), prefix with
``{tenant_iri}/{kind}/``. Same (kind, label) -> same candidate IRI every
time, which is what makes repeated NL/import authoring of the same concept
idempotent (used pre-dispatch to preview the IRI and check for collisions
via CE-READ-1, per the task brief's implementation hint).
"""

from __future__ import annotations

import re

_PUNCTUATION_RE = re.compile(r"[^\w\s-]")
_WHITESPACE_RE = re.compile(r"\s+")


def slugify(label: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace, hyphenate."""
    stripped = _PUNCTUATION_RE.sub("", label).strip().lower()
    return _WHITESPACE_RE.sub("-", stripped)


def build_class_iri(tenant_iri: str, kind: str, label: str) -> str:
    """Deterministic candidate IRI for a class of the given `kind`+`label`,
    scoped under `tenant_iri`. Idempotent: identical (kind, label) -- up to
    the `slugify` normalisation -- always yields the same string.
    """
    return f"{tenant_iri}/{kind}/{slugify(label)}"
