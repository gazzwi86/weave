"""CE-V1-TASK-014 AC-003-01: per-format chunking with locators, mandatory
fixed-window fallback, and the AC-003-01 XML seam left for TASK-015
(post-v1) -- see `corpus/chunking.py` module docstring for the deferral.
"""

from __future__ import annotations

import pytest

from weave_backend.corpus.chunking import (
    NotationChunkingUnavailable,
    chunk_artefact,
    passage_id,
)


def test_should_split_prose_by_headings_to_target_tokens_with_overlap_and_locators() -> None:
    body = " ".join(f"word{i}" for i in range(1200))
    content = f"# Intro\n{body}\n".encode()

    passages = chunk_artefact(content, ext="md", artefact_hash="abc123")

    assert len(passages) > 1
    # every passage carries a locator derived from the section heading
    assert all(p.locator.startswith("Intro") for p in passages)
    # ~512-token target: no passage wildly exceeds it
    assert all(len(p.text.split()) <= 600 for p in passages)
    # ~15% overlap: consecutive windows share trailing/leading words
    first_tail = passages[0].text.split()[-10:]
    second_head = passages[1].text.split()[:80]
    assert any(word in second_head for word in first_tail)


def test_should_fall_back_to_fixed_windows_on_unrecognised_format() -> None:
    """`unknown-format-still-chunks` -- named test, AC-003-01 pin 1a."""
    content = b"just some plain content with no structure at all " * 50

    passages = chunk_artefact(content, ext="bin", artefact_hash="def456")

    assert len(passages) >= 1
    assert all(p.text for p in passages)


def test_should_produce_deterministic_passage_ids_for_same_artefact_and_locator() -> None:
    assert passage_id("abc123", "Intro#0") == passage_id("abc123", "Intro#0")
    assert passage_id("abc123", "Intro#0") != passage_id("abc123", "Intro#1")


def test_xml_notation_chunking_raises_honest_unavailable_pending_task_015() -> None:
    """AC-003-01: the ArchiMate/BPMN per-element splitter consumes TASK-015's
    parsed notation model (post-v1, not built) -- no second XML parser is
    written here (brief's "no second parser" rule). The seam raises a named,
    catchable exception rather than silently mis-chunking.
    """
    with pytest.raises(NotationChunkingUnavailable, match="TASK-015"):
        chunk_artefact(b"<xml/>", ext="xml", artefact_hash="ghi789")
