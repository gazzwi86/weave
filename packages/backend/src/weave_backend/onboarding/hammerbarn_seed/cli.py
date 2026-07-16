"""CLI entrypoint for the Hammerbarn seed pipeline (TASK-002 DoD: "CLI
documented (--compile, --apply --workspace <id>, --verify)").

Installed as ``weave-hammerbarn-seed`` (see `pyproject.toml`
``[project.scripts]``). Talks to the *live* CE-READ-1/CE-WRITE-1/
CE-VERSION-1 HTTP surface via `apply.py` -- never a direct DB write --
so a re-run genuinely re-exercises the engine's own SHACL validation
(AC-002-01/-03/-04/-07), not an assumed-valid bulk load.

Usage::

    uv run weave-hammerbarn-seed --compile
    uv run weave-hammerbarn-seed --apply --workspace <id> --token <jwt>
    uv run weave-hammerbarn-seed --verify --workspace <id> --token <jwt>

A bearer ``--token`` is obtained separately (mock-oidc in dev, Cognito in
prod, `POST /token`) -- this CLI is a content pipeline, not an auth client,
so it never mints its own token. ``--compile`` alone needs no token: it
falls back to the same local `ontology.catalogue.list_kinds()` source
`GET /api/ontology/types` itself reads (`test_hammerbarn_seed_compile.py`'s
own fixture pattern), so a content author can check the artefact shape
compiles before any stack is up. Passing ``--token`` with ``--compile``
validates against the live endpoint instead -- ponytail: no separate flag
for this, presence of ``--token`` is the signal.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

import httpx

from weave_backend.onboarding.hammerbarn_seed.apply import SeedApplyHalted, apply_seed, ask_count
from weave_backend.onboarding.hammerbarn_seed.compile import (
    CompiledArtefact,
    allowed_kinds_from_ontology_types,
    compile_seed,
)
from weave_backend.ontology import catalogue

_DEFAULT_BASE_URL = "http://localhost:8000"
_DEFAULT_ACTOR = "urn:weave:principal:service:hammerbarn-seed"


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="weave-hammerbarn-seed", description=__doc__.splitlines()[0]
    )
    parser.add_argument(
        "--compile", action="store_true", help="compile content.py, print the artefact shape"
    )
    parser.add_argument(
        "--apply", action="store_true", help="apply the compiled artefact into --workspace"
    )
    parser.add_argument(
        "--verify", action="store_true", help="print the live triple count for --workspace"
    )
    parser.add_argument("--workspace", help="workspace id -- required for --apply/--verify")
    parser.add_argument(
        "--base-url",
        default=_DEFAULT_BASE_URL,
        help=f"backend base URL (default {_DEFAULT_BASE_URL})",
    )
    parser.add_argument("--token", help="bearer JWT -- required for --apply/--verify")
    parser.add_argument("--actor", default=_DEFAULT_ACTOR, help="actor IRI attributed on --apply")
    return parser


def _local_allowed_kinds() -> set[str]:
    """Same kind set `GET /api/ontology/types` (CE-READ-1) would serve, read
    straight from the shipped SHACL shapes -- see module docstring.
    """
    kinds = catalogue.list_kinds()
    return allowed_kinds_from_ontology_types({"kinds": [{"iri": k.iri} for k in kinds]})


async def _live_allowed_kinds(client: httpx.AsyncClient, *, headers: dict[str, str]) -> set[str]:
    response = await client.get("/api/ontology/types", headers=headers)
    response.raise_for_status()
    return allowed_kinds_from_ontology_types(response.json())


def _is_already_published(exc: httpx.HTTPStatusError) -> bool:
    """AC-002-09's exact wording: `apply_seed` deliberately raises when a
    reseed's content hasn't changed since the last apply (same semver ->
    same idempotency-keyed batches -> same version_iri -> publish refuses a
    second time because a published version is immutable). That's a
    correct, tested invariant at the library level
    (`test_apply_rerun_converges_ask_count_unchanged` pins it as a raise) --
    but for a CLI reseed script, "nothing changed" isn't a real failure, so
    `_run` treats this one specific error as an idempotent no-op (exit 0)
    rather than a bare traceback (exit 1).
    """
    if exc.response.status_code != 405:
        return False
    detail = exc.response.json().get("detail", {})
    return bool(detail.get("message") == "version is published and immutable")


async def _compile(client: httpx.AsyncClient, *, headers: dict[str, str]) -> CompiledArtefact:
    allowed_kinds = (
        await _live_allowed_kinds(client, headers=headers) if headers else _local_allowed_kinds()
    )
    artefact = compile_seed(allowed_kinds=allowed_kinds)
    print(
        json.dumps(
            {
                "semver": artefact.semver,
                "batches": len(artefact.batches),
                "ops": sum(len(batch) for batch in artefact.batches),
            }
        )
    )
    return artefact


def _validate_args(args: argparse.Namespace) -> int | None:
    if not (args.compile or args.apply or args.verify):
        print("nothing to do -- pass --compile, --apply, or --verify", file=sys.stderr)
        return 2
    if (args.apply or args.verify) and not args.token:
        print("--token is required for --apply/--verify", file=sys.stderr)
        return 2
    if (args.apply or args.verify) and not args.workspace:
        print("--workspace is required for --apply/--verify", file=sys.stderr)
        return 2
    return None


async def _do_apply(
    client: httpx.AsyncClient, artefact: CompiledArtefact, *, actor: str, headers: dict[str, str]
) -> int:
    try:
        result = await apply_seed(client, artefact, actor=actor, headers=headers)
    except SeedApplyHalted as exc:
        print(
            json.dumps({"halted_batch": exc.batch_index, "violations": exc.violations}),
            file=sys.stderr,
        )
        return 1
    except httpx.HTTPStatusError as exc:
        if not _is_already_published(exc):
            raise
        print(json.dumps({"applied_count": 0, "already_published": True}))
        return 0
    print(json.dumps({"version_iri": result.version_iri, "applied_count": result.applied_count}))
    return 0


async def _run(args: argparse.Namespace) -> int:
    early_exit = _validate_args(args)
    if early_exit is not None:
        return early_exit

    headers = {"Authorization": f"Bearer {args.token}"} if args.token else {}

    async with httpx.AsyncClient(base_url=args.base_url, timeout=30.0) as client:
        if args.apply or args.verify:
            switch = await client.post(f"/api/workspaces/{args.workspace}/switch", headers=headers)
            switch.raise_for_status()

        artefact: CompiledArtefact | None = None
        if args.compile or args.apply:
            artefact = await _compile(client, headers=headers)

        if args.apply and artefact is not None:
            exit_code = await _do_apply(client, artefact, actor=args.actor, headers=headers)
            if exit_code != 0:
                return exit_code

        if args.verify:
            count = await ask_count(client, headers=headers)
            print(json.dumps({"triple_count": count}))

    return 0


def main() -> None:
    args = _build_parser().parse_args()
    sys.exit(asyncio.run(_run(args)))
