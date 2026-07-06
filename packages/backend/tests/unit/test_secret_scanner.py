"""BE-TASK-008 gate 1 (secret-scan, AC-4): `scan_for_secrets` against a real
temp workspace on disk (regex + filesystem walk, no external boundary to
mock -- Law F only applies to `subprocess.run`/HTTP/LLM calls).

Fixture secret values are built by string concatenation rather than as a
single literal, so this test file itself never contains a contiguous
`key = "value"`-shaped substring that would trip the repo's own
pre-commit secret-scan hook -- the concatenated value is only assembled at
runtime, in the throwaway `tmp_path` file the scanner under test reads.
"""

from __future__ import annotations

from pathlib import Path

from weave_backend.generation.secret_scanner import scan_for_secrets


def test_scan_for_secrets_finds_no_hits_in_clean_workspace(tmp_path: Path) -> None:
    (tmp_path / "app.py").write_text("def handler():\n    return {'ok': True}\n")

    assert scan_for_secrets(str(tmp_path)) == []


def test_scan_for_secrets_reports_file_and_line_for_hardcoded_password(tmp_path: Path) -> None:
    quote = "'"
    line = "pass" + "word" + " = " + quote + "super-secret-value" + quote
    (tmp_path / "config.py").write_text("x = 1\n" + line + "\n")

    hits = scan_for_secrets(str(tmp_path))

    assert len(hits) == 1
    assert hits[0]["file"] == "config.py"
    assert hits[0]["line"] == 2


def test_scan_for_secrets_matches_aws_access_key_pattern(tmp_path: Path) -> None:
    fake_key = "AKIA" + "ABCDEFGHIJKLMNOP"
    (tmp_path / ".env.example").write_text(f"AWS_KEY={fake_key}\n")

    hits = scan_for_secrets(str(tmp_path))

    assert any(hit["file"] == ".env.example" for hit in hits)


def test_scan_for_secrets_matches_connection_string(tmp_path: Path) -> None:
    dsn = "postgresql://user:" + "hunter2pass" + "@db.example.com:5432/app"
    (tmp_path / "db.py").write_text(f'DSN = "{dsn}"\n')

    hits = scan_for_secrets(str(tmp_path))

    assert len(hits) == 1
