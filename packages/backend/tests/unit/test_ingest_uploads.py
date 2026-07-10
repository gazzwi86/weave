"""CE-V1-TASK-012 unit test: AC-001-10 -- reject oversize/missing file before
any storage call. `validate_upload` is pure (no I/O), so "before any storage
call" holds structurally: nothing here can reach S3/DB before raising.
"""

from __future__ import annotations

import pytest
from weave_backend.ingest.uploads import UploadRejected, validate_upload

MAX_BYTES = 25 * 1024 * 1024


def test_validate_upload_rejects_empty_file() -> None:
    with pytest.raises(UploadRejected):
        validate_upload(b"", max_upload_bytes=MAX_BYTES)


def test_validate_upload_rejects_file_over_the_cap() -> None:
    oversize = b"x" * (MAX_BYTES + 1)
    with pytest.raises(UploadRejected):
        validate_upload(oversize, max_upload_bytes=MAX_BYTES)


def test_validate_upload_accepts_file_within_the_cap() -> None:
    validate_upload(b"small file", max_upload_bytes=MAX_BYTES)
