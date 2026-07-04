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
# branch is allowed; a bare `--force`/`-f`/`+refspec` is refused everywhere (all
# clobber the remote unconditionally); any force aimed at main/master is refused.
#
# THIS HOOK IS THE SOLE ENFORCEMENT. This repo has no server-side branch
# protection (private repo on a plan without protected branches — verified), so
# the checks below must be airtight, not "a first line". If the repo later gains
# branch protection, this stays as defence-in-depth.
_FORCE_WITH_LEASE_RE = re.compile(r"--force-with-lease\b")
_BARE_FORCE_RE = re.compile(r"--force\b(?!-with-lease)")
# short `-f` (or clustered like -fv); the (?<![-\w]) guards against matching the
# `-force` inside `--force-with-lease`.
_SHORT_FORCE_RE = re.compile(r"(?<![-\w])-[A-Za-z]*f[A-Za-z]*\b")
# `git push origin +main` / `+refs/...` — force-push syntax with no --force flag.
_PLUS_REFSPEC_RE = re.compile(r"(?:^|\s)\+[^\s]+")
# main/master as a whole ref token — NOT inside a hyphenated name like `main-nav`.
_PROTECTED_REF_RE = re.compile(r"(?<![\w-])(?:main|master)(?![\w-])")
# isolate just the `git push …` command from a compound line so a `-f` in a
# neighbour (`rm -f && git push …`) never counts as a push force flag.
_PUSH_SEG_RE = re.compile(r"\bgit\s+push\b[^|&;\n]*")

_FORCE_BARE_FIX = (
    "git-safety: refusing an unconditional force-push (`--force` / `-f` / `+refspec`). It "
    "overwrites the remote and can clobber another push. Use `--force-with-lease`, which aborts if "
    "the remote moved since you fetched. See .claude/rules/git-safety.md."
)
_FORCE_PROTECTED_FIX = (
    "git-safety: refusing to force-push main/master. Force-push is permitted only on feature/* "
    "branches (e.g. restacking a stacked PR onto a merged base). See .claude/rules/git-safety.md."
)


def _has_explicit_refspec(seg: str) -> bool:
    """True if the push names a remote AND a refspec (>=2 non-flag args after
    `git push`). `git push` / `git push origin` push the CURRENT branch, so the
    target is HEAD, not anything in the command text."""
    args = [t for t in seg.split()[2:] if not t.startswith(("-", "+"))]
    return len(args) >= 2


def _pushes_protected_head() -> bool:
    """Current branch is main/master? Fail closed (treat as protected) if we
    cannot determine it — a force-with-lease with no refspec must not slip
    through just because the branch lookup failed."""
    import subprocess

    try:
        out = subprocess.run(
            ["git", "branch", "--show-current"],
            capture_output=True, text=True, timeout=3, check=False,
        )
        return out.stdout.strip() in ("main", "master")
    except Exception:
        return True


def check_force_push(payload: dict) -> None:
    """PreToolUse:Bash — allow `--force-with-lease` on feature branches (needed to restack
    stacked PRs after their base merges) while refusing any unconditional force
    (`--force`/`-f`/`+refspec`) and any force-push targeting main/master."""
    if (payload.get("tool_name") or "") != "Bash":
        return
    cmd = (payload.get("tool_input") or {}).get("command") or ""
    if "push" not in cmd:
        return

    body = _HEREDOC_RE.sub("", cmd)
    for seg_match in _PUSH_SEG_RE.finditer(body):
        # Strip quote CHARACTERS (not quoted content) so `git push "--force"` — which the shell
        # unquotes to a real --force — is still seen; but keep it scoped to this push segment.
        seg = seg_match.group(0).replace('"', "").replace("'", "")

        has_lease = bool(_FORCE_WITH_LEASE_RE.search(seg))
        has_uncond = bool(
            _BARE_FORCE_RE.search(seg) or _SHORT_FORCE_RE.search(seg) or _PLUS_REFSPEC_RE.search(seg)
        )
        if not (has_lease or has_uncond):
            continue  # ordinary push — nothing to gate

        if has_uncond:
            block(_FORCE_BARE_FIX)
        # only --force-with-lease reaches here: allowed unless it targets a protected branch,
        # either named explicitly or implied by HEAD when no refspec is given.
        if _PROTECTED_REF_RE.search(seg) or (
            not _has_explicit_refspec(seg) and _pushes_protected_head()
        ):
            block(_FORCE_PROTECTED_FIX)


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
