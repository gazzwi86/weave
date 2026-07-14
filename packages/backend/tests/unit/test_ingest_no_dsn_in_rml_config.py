"""CE-V1-TASK-019 AC-008-05: CI structural assert, `no-DSN-in-RML-config`.

Deferred (see `.claude/state/escalations/CE-V1-TASK-019-partial.md`).

# ponytail: no R2RML/RML mapping config file exists yet -- there is nothing
# to scan for an embedded DSN. Un-skip once TASK-017 (structured import)
# lands the mapping config, then point this at that file's path.
"""

import pytest

_SKIP_REASON = "TASK-017 (R2RML/RML mapping layer) not built yet -- no config file to scan"


@pytest.mark.skip(reason=_SKIP_REASON)
def test_no_dsn_in_rml_config() -> None:
    raise NotImplementedError("wire once TASK-017 lands the RML mapping config")
