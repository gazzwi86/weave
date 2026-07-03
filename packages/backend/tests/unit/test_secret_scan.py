"""AC-6: secret scanning rejects committed credential patterns without leaking them.

Uses gitleaks (installed locally via `brew install gitleaks`; CI downloads the pinned
binary directly). The fake AWS access key is built at runtime from parts so the literal
pattern never appears in this source file or the git history.
"""

from __future__ import annotations

import json
import random
import shutil
import string
import subprocess
from pathlib import Path

import pytest

pytestmark = pytest.mark.skipif(
    shutil.which("gitleaks") is None, reason="gitleaks binary not installed"
)


def _fake_aws_access_key() -> str:
    """Build a syntactically-valid, never-real AWS access key id at runtime."""
    suffix = "".join(random.choice(string.ascii_uppercase + string.digits) for _ in range(16))
    return "AKIA" + suffix


def test_secret_scan_rejects_credential_pattern(repo_root: Path, tmp_path: Path) -> None:
    fixture = tmp_path / "leaked_config.py"
    fixture.write_text(f'aws_access_key_id = "{_fake_aws_access_key()}"\n')
    report_path = tmp_path / "report.json"

    result = subprocess.run(
        [
            "gitleaks",
            "detect",
            "--no-git",
            f"--source={tmp_path}",
            f"--config={repo_root / '.gitleaks.toml'}",
            "--redact",
            "--report-format=json",
            f"--report-path={report_path}",
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )

    assert result.returncode != 0, "gitleaks should exit non-zero when a credential is found"

    findings = json.loads(report_path.read_text())
    assert len(findings) == 1
    finding = findings[0]
    assert finding["File"] == "leaked_config.py"
    assert finding["RuleID"]
    # --redact must strip the raw secret from both the report and stdout/stderr.
    assert finding["Secret"] == "REDACTED"
    assert finding["Match"] == "REDACTED"
    assert "AKIA" not in result.stdout
    assert "AKIA" not in result.stderr
