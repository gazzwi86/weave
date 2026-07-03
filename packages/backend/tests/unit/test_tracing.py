"""AC-5 (unit slice): the span-attribute hook always stamps ``engine`` and
falls back to ``urn:weave:anonymous`` for ``principal_iri``, but refuses to
emit a span with no ``tenant_id`` while ``WEAVE_TESTING=1`` — a missing
tenant on a real request is a bug, not a value to silently paper over.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from weave_backend.observability.context import (
    principal_iri_var,
    tenant_id_var,
)
from weave_backend.observability.tracing import add_tenant_attributes


def test_otel_span_missing_tenant_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WEAVE_TESTING", "1")
    token = tenant_id_var.set(None)
    span = MagicMock()
    try:
        with pytest.raises(RuntimeError, match="tenant_id"):
            add_tenant_attributes(span, {})
    finally:
        tenant_id_var.reset(token)


def test_add_tenant_attributes_stamps_all_three(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WEAVE_TESTING", "1")
    tenant_token = tenant_id_var.set("acme-corp")
    principal_token = principal_iri_var.set("urn:weave:principal:dev-user-1")
    span = MagicMock()
    try:
        add_tenant_attributes(span, {})
    finally:
        tenant_id_var.reset(tenant_token)
        principal_iri_var.reset(principal_token)

    span.set_attribute.assert_any_call("tenant_id", "acme-corp")
    span.set_attribute.assert_any_call("engine", "platform")
    span.set_attribute.assert_any_call("principal_iri", "urn:weave:principal:dev-user-1")
