"""CE-V1-TASK-014 AC-003-01: chunk assembly for the corpus store.

Reuses `ingest.document_parsing.parse_simple` (TASK-013) for prose/docx/pdf
heading trees + the mandatory fixed-window fallback -- this module owns only
token-windowing on top of those sections + deterministic passage ids
(ADR-011 pin 1a: "no second parser").

**AC-003-01 XML branch deferred** (coordinator decision, see PR body): the
ArchiMate/BPMN per-element splitter was specified to consume TASK-015's
parsed notation model (`docs/specs/weave/engines/constitution-engine/
post-v1/tasks/TASK-015.md`), which is milestone `post-v1` and not built.
Building a second, local XML parser here to fill that gap would violate the
brief's own "no second parser" rule and create throwaway tech debt.
`chunk_xml_notation` is the seam TASK-015 plugs into; until then it raises
`NotationChunkingUnavailable` -- an honest degraded state, not a silent
mis-chunk or a fake parser.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from weave_backend.ingest.document_parsing import Section, parse_simple

#: ADR-011 pin 1a: ~512-token target window with ~15% overlap. "Token" here
#: is approximated as a whitespace-split word -- exact BPE tokenisation
#: would need a new dependency for a target that's already a soft heuristic.
_TARGET_WORDS = 512
_OVERLAP_WORDS = round(_TARGET_WORDS * 0.15)
_STEP_WORDS = _TARGET_WORDS - _OVERLAP_WORDS

#: Extensions routed to the (unbuilt) notation splitter -- ArchiMate
#: Exchange Format and BPMN are both XML.
_NOTATION_EXTS = {"xml"}


class NotationChunkingUnavailable(Exception):
    """AC-003-01: the XML per-element splitter has no upstream parser yet."""


@dataclass(frozen=True)
class Passage:
    id: str
    locator: str
    text: str


def passage_id(artefact_hash: str, locator: str) -> str:
    """Deterministic per (artefact_hash, locator) so a re-ingest replaces
    the same passage ids instead of duplicating (AC-003-08 pitfall).
    """
    digest = hashlib.sha256(f"{artefact_hash}:{locator}".encode()).hexdigest()
    return digest[:24]


def chunk_xml_notation(parsed_model: object) -> list[Passage]:
    del parsed_model  # seam signature only -- TASK-015 supplies the real arg
    raise NotationChunkingUnavailable(
        "XML chunking unavailable -- pending TASK-015 (post-v1, not yet built)"
    )


def _word_windows(text: str) -> list[str]:
    words = text.split()
    if not words:
        return [""]
    if len(words) <= _TARGET_WORDS:
        return [text]
    windows = []
    start = 0
    while start < len(words):
        windows.append(" ".join(words[start : start + _TARGET_WORDS]))
        if start + _TARGET_WORDS >= len(words):
            break
        start += _STEP_WORDS
    return windows


def _section_passages(section: Section, artefact_hash: str) -> list[Passage]:
    windows = _word_windows(section.text)
    locators = [section.heading_path] if len(windows) == 1 else [
        f"{section.heading_path}#{i}" for i in range(len(windows))
    ]
    return [
        Passage(id=passage_id(artefact_hash, locator), locator=locator, text=text)
        for locator, text in zip(locators, windows, strict=True)
    ]


def chunk_artefact(content: bytes, *, ext: str, artefact_hash: str) -> list[Passage]:
    """AC-003-01: dispatch by format -- xml (unbuilt, raises), else reuse
    TASK-013's `parse_simple` sections (prose/docx/pdf/fixed-window
    fallback), token-windowed with overlap and a locator per passage.
    """
    if ext.lower() in _NOTATION_EXTS:
        return chunk_xml_notation(None)
    sections = parse_simple(content, ext.lower())
    passages = []
    for section in sections:
        passages.extend(_section_passages(section, artefact_hash))
    return passages
