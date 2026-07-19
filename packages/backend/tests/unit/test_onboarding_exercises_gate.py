"""T8: `available_exercises()` -- the ids `gate_exercise` currently allows
for a given (role_path, path_variant), used by `GET /onboarding/state` so
the checklist client stops POSTing to `/check` for an exercise it can't
complete (path_gated / read_only_locked 403 noise).
"""

from __future__ import annotations

from weave_backend.onboarding.exercises import available_exercises


def test_technical_default_includes_the_technical_only_exercise() -> None:
    ids = available_exercises(role_path="technical", path_variant="default")

    assert "CE-03" in ids
    assert "CE-03b" not in ids  # business/compliance/admin only


def test_business_default_excludes_the_technical_only_exercise() -> None:
    ids = available_exercises(role_path="business", path_variant="default")

    assert "CE-03" not in ids
    assert "CE-03b" in ids


def test_read_only_variant_excludes_the_one_write_exercise() -> None:
    ids = available_exercises(role_path="business", path_variant="read_only")

    assert "CE-02" not in ids
    assert "CE-01" in ids  # non-write exercises stay available


def test_default_variant_includes_the_write_exercise() -> None:
    ids = available_exercises(role_path="business", path_variant="default")

    assert "CE-02" in ids
