"""TASK-011 seam / TASK-012 fills `resolve()`'s body in this same file (no
fork -- TASK-012's own brief names this exact path). The generate endpoint
(`dashboard/generate.py`) only ever talks to the `Resolver` callable shape
below, injected via FastAPI `Depends(get_dashboard_agent_resolver)` --
mirrors `ce_metrics.get_ce_metrics_client`'s DI seam so every TASK-011 test
fakes the resolver via `app.dependency_overrides` rather than needing a real
LLM call (Law F).

TASK-012: `resolve()` classifies via a JSON+Pydantic structured-extraction
call (no native tool-calling infra in `ai/providers.py` -- mirrors
`authoring/nl_parser.py`'s pattern), then a *pure* rule table
(`_map_classification`) deterministically picks the component -- the model
never freely names a component, only a `data_shape` (+ optional
`named_type` override), so out-of-library output is structurally
impossible (m2-delta.md §2).
"""

from __future__ import annotations

import asyncio
import json
import re
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Literal, get_args

from pydantic import BaseModel, Field, ValidationError

from weave_backend.ai.router import route
from weave_backend.dashboard.availability import engine_of_contract, is_ga
from weave_backend.dashboard.compat import COMPAT, PRIMARY
from weave_backend.schemas.dashboard import ComponentType, WidgetSpec

_TIER = "sonnet"

# Same failure mode nl_parser.py already handles: models fence JSON even
# when told not to.
_FENCE_RE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE | re.MULTILINE)

_DEFAULT_COLUMN_SPAN = 6

#: category (a semantic label the model classifies to) -> owning contract.
#: Reuses the same literal contract ids `dashboard/example_prompts.py`
#: already names (single source of contract-id truth); "CE" is the only GA
#: engine at M2, the `build_*` categories exist precisely so
#: `test_non_ga_returns_source_not_ga_not_none` can exercise a real,
#: registry-backed `source_not_ga` path (m2-delta §2).
CATEGORIES: dict[str, str] = {
    "entity_metrics": "CE-METRICS-1",
    "build_cost": "BUILD-COST-1",
    "build_runs": "BUILD-RUNS-1",
    "build_deploy": "BUILD-DEPLOY-1",
}

DataShape = Literal[
    "scalar", "series", "categorical", "ranked", "events", "ratio", "matrix", "rows"
]


class ProviderUnavailable(Exception):
    """AC-4: the AI provider is unconfigured/unreachable."""


@dataclass(frozen=True)
class SourceNotGA:
    """AC-6: the resolver classified the prompt to a real category whose
    owning engine the availability registry (`dashboard/availability.py`)
    has not marked GA. `source_engine` is carried through verbatim into the
    SSE error event's `reason` -- this dataclass never re-derives GA-ness
    itself, the resolver (TASK-012) already decided it via the registry.
    """

    source_engine: str


#: `None` means "no component/data-shape match" (`unsatisfiable`, TASK-012).
ResolveResult = WidgetSpec | SourceNotGA | None

#: TASK-013: `context` is the widget's current spec on a refine call (delta
#: prompt classified against it); `None` on a plain generate. Every caller
#: (`generate.py::_resolve_with_context`) always passes both positionally,
#: so every fake/resolver -- including every TASK-011 test double -- takes
#: the same two params.
Resolver = Callable[[str, WidgetSpec | None], Awaitable[ResolveResult]]


class IntentClassification(BaseModel):
    """The "tool schema": enum-constrained fields the model must emit.
    `data_shape`/`named_type` being real `Literal`s means an out-of-library
    value fails Pydantic validation before it ever reaches the rule table --
    the "never free-form" guarantee is structural, not prompt-engineered.
    """

    data_shape: DataShape
    category: str = Field(min_length=1)
    field: str = Field(min_length=1)
    named_type: ComponentType | None = None
    title: str = Field(min_length=1)


def _build_prompt(
    prompt: str, *, context: WidgetSpec | None = None, retry_error: str | None = None
) -> str:
    instruction: dict[str, object] = {
        "instruction": (
            'Classify the request into {"data_shape": ..., "category": ..., '
            '"field": ..., "named_type": ..., "title": ...} JSON. '
            f"data_shape must be exactly one of: {sorted(get_args(DataShape))}. "
            f"category must be exactly one of: {sorted(CATEGORIES)}. "
            f"named_type is optional; if given, must be exactly one of: "
            f"{sorted(get_args(ComponentType))}. "
            "Return only the JSON object, with no markdown fences or prose."
        ),
        "request": prompt,
    }
    if context is not None:
        # TASK-013: refine -- classify the delta *against* the widget's
        # current spec, not from a blank slate.
        instruction["instruction"] = (
            "The user is refining an existing widget with a follow-up request. "
            + str(instruction["instruction"])
        )
        instruction["current_spec"] = context.model_dump()
    if retry_error:
        instruction["previous_error"] = retry_error
    return json.dumps(instruction)


def _parse_classification(raw: str) -> IntentClassification | None:
    try:
        payload = json.loads(_FENCE_RE.sub("", raw).strip())
    except json.JSONDecodeError:
        return None
    try:
        return IntentClassification.model_validate(payload)
    except ValidationError:
        return None


def _override_note(shape: DataShape, named_type: ComponentType, component: str) -> str:
    return f"'{named_type}' isn't compatible with {shape} data; used {component} instead."


def _map_classification(classification: IntentClassification) -> ResolveResult:
    """AC-1/AC-2/AC-3: the pure rule-table decision -- no I/O, so this is
    what the intent-mapping audit / override / decline unit tests exercise
    directly against recorded fixtures (Plugin Law F).
    """
    contract = CATEGORIES.get(classification.category)
    if contract is None:
        return None  # unsatisfiable: no data source for this intent at all

    engine = engine_of_contract(contract)
    if not is_ga(engine):
        return SourceNotGA(engine)

    compatible = COMPAT.get(classification.data_shape)
    if not compatible:
        return None  # unsatisfiable: no library component matches this shape

    named_type = classification.named_type
    if named_type is not None and named_type in compatible:
        component = named_type
        override_note = None
    else:
        component = PRIMARY[classification.data_shape]
        override_note = (
            _override_note(classification.data_shape, named_type, component) if named_type else None
        )

    return WidgetSpec(
        component_type=component,
        title=classification.title,
        data_source_contracts=[contract],
        bindings={"field": classification.field},
        column_span=_DEFAULT_COLUMN_SPAN,
        override_note=override_note,
        data_shape=classification.data_shape,
    )


async def _call_model(prompt_payload: str) -> str:
    """AC-4: graceful-degradation boundary around the provider call --
    mirrors `routers/authoring.py`'s pattern. Any real connection/auth
    failure (unconfigured/unreachable provider) becomes `ProviderUnavailable`,
    the only exception `generate.py` catches to emit `provider_503`. Logs
    only the exception type, never the prompt (PII/business data).
    """
    try:
        return await asyncio.to_thread(route, _TIER, prompt_payload)
    except Exception as exc:
        raise ProviderUnavailable(type(exc).__name__) from exc


async def resolve(prompt: str, context: WidgetSpec | None = None) -> ResolveResult:
    """AC-4: one retry (with the validation error fed back) if the model's
    output doesn't parse as JSON or fails the `IntentClassification` schema;
    a second failure declines (`None` -> `unsatisfiable`), never an
    unvalidated spec on the stream.

    TASK-013 AC-1: `context` (the widget's current spec, on a refine call)
    is folded into the prompt but never changes the retry/decline shape --
    refine reuses the exact same classify-then-map pipeline as generate.
    """
    raw = await _call_model(_build_prompt(prompt, context=context))
    classification = _parse_classification(raw)
    if classification is None:
        retry_raw = await _call_model(
            _build_prompt(
                prompt, context=context, retry_error="output was not valid JSON matching the schema"
            )
        )
        classification = _parse_classification(retry_raw)
        if classification is None:
            return None
    return _map_classification(classification)


async def get_dashboard_agent_resolver() -> Resolver:
    """FastAPI dependency returning the active resolver. Tests override this
    dependency (`app.dependency_overrides[get_dashboard_agent_resolver]`) to
    inject a fake classifying prompts deterministically.
    """
    return resolve
