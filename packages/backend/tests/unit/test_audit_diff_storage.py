"""Brief's diff_summary >8KB overflow rule -- oversize path mocked (no real
LocalStack S3 call in the unit lane; see the docker-marked integration test
for the real round trip).
"""

from __future__ import annotations

from unittest.mock import patch

from weave_backend.audit.diff_storage import DIFF_SUMMARY_MAX_BYTES, cap_diff_summary


async def test_cap_diff_summary_returns_unchanged_when_within_cap() -> None:
    diff = {"slug": "eng-team"}
    result = await cap_diff_summary("tenant-abc", 1, diff)
    assert result == diff


async def test_cap_diff_summary_returns_none_for_none_input() -> None:
    assert await cap_diff_summary("tenant-abc", 1, None) is None


async def test_cap_diff_summary_offloads_oversize_diff_to_s3() -> None:
    oversize_diff = {"blob": "x" * (DIFF_SUMMARY_MAX_BYTES + 1)}
    with patch(
        "weave_backend.audit.diff_storage._store_oversize_diff_sync",
        return_value="tenant/tenant-abc/audit/1.json",
    ) as mock_store:
        result = await cap_diff_summary("tenant-abc", 1, oversize_diff)
    mock_store.assert_called_once_with("tenant-abc", 1, oversize_diff)
    assert result == {"s3_key": "tenant/tenant-abc/audit/1.json"}
