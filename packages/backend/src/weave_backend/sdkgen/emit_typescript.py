"""BE-SDK-1 TypeScript emitter (ADR-006 SS2) -- a "dumb template" consumer
of :class:`~weave_backend.sdkgen.ir.SdkModel`. All mapping decisions
already happened in ``ir.py``; this module only renders.
"""

from __future__ import annotations

from pathlib import Path

import jinja2

from weave_backend.sdkgen.ir import SdkModel

_TEMPLATES_DIR = Path(__file__).resolve().parent / "templates" / "typescript"
_TEMPLATE_FILES = (
    ("index.ts.j2", "index.ts"),
    ("errors.ts.j2", "errors.ts"),
    ("tsconfig.json.j2", "tsconfig.json"),
)


def _env() -> jinja2.Environment:
    # StrictUndefined (Implementation Hints): an undefined template
    # variable must be a loud failure, never an empty string baked into
    # generated client code.
    #
    # autoescape=False is correct here, not a shortcut: this template
    # renders TypeScript source text, never HTML/JS-in-a-browser. HTML
    # escaping would corrupt the output (e.g. `Promise<Row[]>` -> the
    # literal string `Promise&lt;Row[]&gt;`, or `"` in a string literal ->
    # `&#34;`). There is no HTML-injection surface: output is written
    # straight to a .ts file, never rendered in a browser DOM.
    return jinja2.Environment(  # noqa: S701 # nosec B701 -- source template, not HTML
        loader=jinja2.FileSystemLoader(_TEMPLATES_DIR),
        undefined=jinja2.StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )


def emit_typescript(ir: SdkModel, into: Path) -> None:
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
