"""AC-001-10: upload validation, pure/no-I/O -- runs before any storage call
so an oversize or missing file can never reach S3/DB.
"""

from __future__ import annotations


class UploadRejected(Exception):
    """Raised for a 422 (or 413) -- caller maps this to the HTTP response."""


def validate_upload(content: bytes, *, max_upload_bytes: int) -> None:
    if not content:
        raise UploadRejected("no file provided")
    if len(content) > max_upload_bytes:
        raise UploadRejected(f"file exceeds {max_upload_bytes} byte limit")
