"""PostToolUse: ESLint security check — disabled pending project configuration.

To enable: add an eslint.security.config.js at the project root (or per-app),
wire the check-eslint-security handler in settings.json PostToolUse hooks, and
implement check_eslint_security to match this project's directory layout.
"""


def check_eslint_security(_payload: dict) -> None:
    """Stub — not wired. See module docstring."""
    return
