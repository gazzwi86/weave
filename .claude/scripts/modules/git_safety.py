"""PreToolUse:Bash — block git push/commit that bypasses git hooks (--no-verify / commit -n).

The harness's enforcement gates run as git hooks: pre-push runs `check-anatomy-fresh`,
`check-harness-manifest`, and (for UI work) `ui_verify`; pre-commit runs lint/format/tests.
`git push --no-verify` or `git commit -n` skips ALL of them — so every such gate is one Bash
call away from bypass. This check closes that hole; it is the structural prerequisite for
calling any pre-push/pre-commit gate "enforced". (Council: DevEx seat, the one change everyone
benefits from. See .claude/reports/H3.)

If a hook is genuinely wrong, the fix is to fix the hook, never to skip it.
"""

import re

from modules.common import block

# Strip quoted strings + heredoc bodies first, so a commit MESSAGE that mentions "--no-verify"
# (e.g. git commit -m "document the --no-verify ban") is NOT a violation — only the real flag is.
_QUOTED_RE = re.compile(r"'[^']*'|\"[^\"]*\"")
_HEREDOC_RE = re.compile(r"<<-?\s*'?(\w+)'?.*?^\1$", re.DOTALL | re.MULTILINE)

_GIT_RE = re.compile(r"\bgit\b")
_NO_VERIFY_RE = re.compile(r"--no-verify\b")
# `git commit -n` (or -n bundled in a short-flag cluster like -an). `push` has no -n shorthand,
# so we only scan commit. [^|&;\n]*? keeps the match inside a single command, not a later piped one.
_COMMIT_N_RE = re.compile(r"\bgit\s+commit\b[^|&;\n]*?\s-[A-Za-z]*n[A-Za-z]*\b")

_FIX = (
    "git-safety: refusing to bypass git hooks. --no-verify / commit -n skips the pre-commit and "
    "pre-push gates (ui_verify, anatomy-fresh, manifest-fresh) that enforce harness quality. "
    "If a hook is wrong, fix the hook — do not skip it. See .claude/rules/git-safety.md."
)

# --- force-push policy (supports restacking stacked PRs) --------------------
# Stacked PRs need a rebase + force-push each time their base merges. A blanket
# `git push --force*` ban (the old settings.json deny) made that impossible, so
# the policy is relocated here with nuance: `--force-with-lease` on a feature
# branch is allowed; a bare `--force`/`-f` is refused everywhere (it clobbers
# the remote unconditionally); any force aimed at main/master is refused (and is
# also blocked server-side by branch protection — this is just the first line).
_PUSH_RE = re.compile(r"\bgit\s+push\b")
_FORCE_WITH_LEASE_RE = re.compile(r"--force-with-lease\b")
_BARE_FORCE_RE = re.compile(r"--force\b(?!-with-lease)")
_SHORT_FORCE_RE = re.compile(r"(?<![-\w])-[A-Za-z]*f[A-Za-z]*\b")
_PROTECTED_REF_RE = re.compile(r"\b(?:main|master)\b")

_FORCE_BARE_FIX = (
    "git-safety: refusing `git push --force` / `-f`. A bare force overwrites the remote "
    "unconditionally and can clobber another push. Use `--force-with-lease`, which aborts if the "
    "remote moved since you fetched. See .claude/rules/git-safety.md."
)
_FORCE_PROTECTED_FIX = (
    "git-safety: refusing to force-push main/master. Force-push is permitted only on feature/* "
    "branches (e.g. restacking a stacked PR onto a merged base). See .claude/rules/git-safety.md."
)


def check_force_push(payload: dict) -> None:
    """PreToolUse:Bash — allow `--force-with-lease` on feature branches (needed to restack
    stacked PRs after their base merges) while still refusing a bare `--force`/`-f` anywhere
    and any force-push targeting main/master."""
    if (payload.get("tool_name") or "") != "Bash":
        return
    cmd = (payload.get("tool_input") or {}).get("command") or ""
    if "push" not in cmd:
        return

    scan = _HEREDOC_RE.sub("", cmd)
    scan = _QUOTED_RE.sub("", scan)
    if not _PUSH_RE.search(scan):
        return

    has_lease = bool(_FORCE_WITH_LEASE_RE.search(scan))
    has_bare = bool(_BARE_FORCE_RE.search(scan) or _SHORT_FORCE_RE.search(scan))
    if not (has_lease or has_bare):
        return  # ordinary push — nothing to gate

    if has_bare:
        block(_FORCE_BARE_FIX)
    if _PROTECTED_REF_RE.search(scan):
        block(_FORCE_PROTECTED_FIX)
    # otherwise: --force-with-lease to a non-protected ref → permitted


def check_no_verify(payload: dict) -> None:
    """PreToolUse:Bash — block any git command that skips hook verification."""
    if (payload.get("tool_name") or "") != "Bash":
        return
    cmd = (payload.get("tool_input") or {}).get("command") or ""
    if "git" not in cmd:
        return

    scan = _HEREDOC_RE.sub("", cmd)
    scan = _QUOTED_RE.sub("", scan)
    if not _GIT_RE.search(scan):
        return

    if _NO_VERIFY_RE.search(scan) or _COMMIT_N_RE.search(scan):
        block(_FIX)
