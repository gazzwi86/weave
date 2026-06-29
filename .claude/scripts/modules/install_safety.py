"""PreToolUse: verify packages exist before installation — prevents slopsquatting attacks.

Intercepts bare package manager install commands and verifies each named package
exists in the registry before allowing installation. This prevents hallucinated
package names (a supply-chain risk: ~20% of LLM-recommended packages are fictitious,
and adversaries register common hallucinated names).
"""

import re
import subprocess
import sys

from modules.common import block

# Patterns to detect install commands and extract package names
_PY_INSTALL = re.compile(
    r"\b(?:uv\s+add|uv\s+pip\s+install|pip3?\s+install)\s+(.*?)(?:\s*&&|\s*;|\s*\|\||$)",
    re.DOTALL,
)
_NPM_INSTALL = re.compile(
    r"\bnpm\s+(?:install|i)\s+(.*?)(?:\s*&&|\s*;|\s*\|\||$)",
    re.DOTALL,
)

# Flags that don't name a package
_OPTION_RE = re.compile(r"^-")
# Version specifiers: pkg==1.0, pkg>=2, pkg[extra]
_PKG_NAME_RE = re.compile(r"^([A-Za-z0-9_.-]+)")


def _extract_py_packages(args_str: str) -> list[str]:
    """Extract package names from a pip/uv install argument string."""
    packages = []
    for token in args_str.split():
        if _OPTION_RE.match(token):
            continue
        m = _PKG_NAME_RE.match(token)
        if m:
            packages.append(m.group(1))
    return packages


def _verify_pypi(pkg: str) -> bool:
    """Return True if pkg exists on PyPI (fast registry check, no download)."""
    try:
        result = subprocess.run(
            ["pip", "index", "versions", pkg],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0 and pkg.lower() in result.stdout.lower()
    except (subprocess.TimeoutExpired, OSError):
        return True  # fail open on network errors


def _verify_npm(pkg: str) -> bool:
    """Return True if pkg exists on the npm registry."""
    try:
        result = subprocess.run(
            ["npm", "view", pkg, "name"],
            capture_output=True, text=True, timeout=10,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, OSError):
        return True  # fail open on network errors


def check_install_safety(payload: dict) -> None:
    """PreToolUse:Bash — verify packages exist before any install command runs."""
    tool_name = payload.get("tool_name") or ""
    if tool_name != "Bash":
        return

    command = (payload.get("tool_input") or {}).get("command") or ""
    if not command:
        return

    # Check Python installs
    for m in _PY_INSTALL.finditer(command):
        pkgs = _extract_py_packages(m.group(1))
        for pkg in pkgs:
            if not _verify_pypi(pkg):
                block(
                    f"install-safety: package '{pkg}' not found on PyPI. "
                    "Verify the package name is correct before installing. "
                    "If it's a private package, use uv add with an explicit index."
                )

    # Check npm installs
    for m in _NPM_INSTALL.finditer(command):
        pkgs = _extract_py_packages(m.group(1))  # same token logic
        for pkg in pkgs:
            if not _verify_npm(pkg):
                block(
                    f"install-safety: package '{pkg}' not found on npm registry. "
                    "Verify the package name before installing."
                )
