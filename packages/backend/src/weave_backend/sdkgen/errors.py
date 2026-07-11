"""BE-SDK-1 (TASK-004) error taxonomy -- every failure path names the
input it failed on (ADR-006 SS3, AC-3/AC-6/AC-7): a generic exception with
no shape/constraint/path context would defeat the "never silent" design
decision the whole pipeline is built around.
"""

from __future__ import annotations


class SdkGenerationError(Exception):
    """Base class for every BE-SDK-1 pipeline failure."""


class UnmappableConstraint(SdkGenerationError):
    """AC-3: a SHACL property constraint on ``shape`` has no mapping-table
    entry. Never caught and silently downgraded to ``Any``/``unknown`` --
    the mapper's only response to an unknown constraint is to raise this.
    """

    def __init__(self, shape: str, constraint: str) -> None:
        self.shape = shape
        self.constraint = constraint
        super().__init__(f"unmappable constraint on shape {shape}: {constraint}")


class UnsafeFunctionIdentifier(SdkGenerationError):
    """Security (XT-BE004-1): a ``CE-FUNCTION-1`` function's ``fn_iri`` or
    ``name`` contains a character outside the safe IRI/identifier charset.
    Both values are interpolated unescaped into a generated-code string
    literal by the emitter templates, so an unvalidated value is a codegen
    injection vector -- this is raised instead of letting the value through.
    """

    def __init__(self, field: str, value: str) -> None:
        self.field = field
        self.value = value
        super().__init__(f"unsafe {field} for generated function: {value!r}")


class CeFetchError(SdkGenerationError):
    """AC-6: a CE-READ-1 / CE-FUNCTION-1 / CE-BRAND-1 input was unreachable.
    Raised before any staging directory is created, so the pipeline fails
    atomically by construction -- there is nothing to clean up.
    """

    def __init__(self, input_name: str, detail: str) -> None:
        self.input_name = input_name
        super().__init__(f"{input_name} unreachable: {detail}")


class GenerationValidationError(SdkGenerationError):
    """AC-7: a post-emit validator (tsc/mypy/openapi-lint) failed over the
    staging directory. The pipeline treats this the same as a fetch
    failure -- the staging dir is discarded, nothing lands.
    """

    def __init__(self, validator: str, detail: str) -> None:
        self.validator = validator
        super().__init__(f"{validator} failed: {detail}")
