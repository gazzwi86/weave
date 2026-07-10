"""BE-SDK-1 Python emitter (ADR-006 SS2) -- a "dumb template" consumer of
:class:`~weave_backend.sdkgen.ir.SdkModel`, mirroring ``emit_typescript.py``.
"""

from __future__ import annotations

from pathlib import Path

import jinja2

from weave_backend.sdkgen.ir import SdkModel, escape_iri_literal

_TEMPLATES_DIR = Path(__file__).resolve().parent / "templates" / "python"
_TEMPLATE_FILES = (
    ("__init__.py.j2", "__init__.py"),
    ("models.py.j2", "models.py"),
    ("errors.py.j2", "errors.py"),
    ("client.py.j2", "client.py"),
    ("theme.py.j2", "theme.py"),
)


def _env() -> jinja2.Environment:
    # autoescape=False is correct: this renders Python source text, never
    # HTML. HTML-escaping would corrupt output (e.g. quotes in string
    # literals). No HTML-injection surface -- written straight to .py files.
    env = jinja2.Environment(  # noqa: S701 # nosec B701 -- source template, not HTML
        loader=jinja2.FileSystemLoader(_TEMPLATES_DIR),
        undefined=jinja2.StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    # XT-BE004-1: percent-encode any character outside the safe IRI charset
    # before it lands inside the quoted string literal in client.py.j2.
    env.filters["escape_iri_literal"] = escape_iri_literal
    return env


def emit_python(ir: SdkModel, into: Path) -> None:
    into.mkdir(parents=True, exist_ok=True)
    env = _env()
    for template_name, out_name in _TEMPLATE_FILES:
        rendered = env.get_template(template_name).render(
            classes=ir.classes,
            functions=ir.functions,
            queries=ir.queries,
            theme=ir.theme,
            pin=ir.pin,
        )
        (into / out_name).write_text(rendered)
