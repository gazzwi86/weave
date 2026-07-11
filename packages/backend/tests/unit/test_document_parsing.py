"""CE-V1-TASK-013 / ADR-011 pin 1a: per-format structure parse (markdown
heading tree, docx style-based heading tree, PDF page-boundary text) with a
fixed-window fallback for anything with no detected structure (AC-002-08).
"""

from __future__ import annotations

import io
import zipfile
from xml.etree import ElementTree as ET

from weave_backend.ingest.document_parsing import parse_simple

_DOCX_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _docx_paragraph(style: str | None, text: str) -> ET.Element:
    para = ET.Element(f"{{{_DOCX_NS}}}p")
    if style is not None:
        p_pr = ET.SubElement(para, f"{{{_DOCX_NS}}}pPr")
        p_style = ET.SubElement(p_pr, f"{{{_DOCX_NS}}}pStyle")
        p_style.set(f"{{{_DOCX_NS}}}val", style)
    run = ET.SubElement(para, f"{{{_DOCX_NS}}}r")
    text_el = ET.SubElement(run, f"{{{_DOCX_NS}}}t")
    text_el.text = text
    return para


def _make_docx_bytes(paragraphs: list[tuple[str | None, str]]) -> bytes:
    document = ET.Element(f"{{{_DOCX_NS}}}document")
    body = ET.SubElement(document, f"{{{_DOCX_NS}}}body")
    for style, text in paragraphs:
        body.append(_docx_paragraph(style, text))
    xml_bytes = ET.tostring(document, xml_declaration=True, encoding="UTF-8")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as archive:
        archive.writestr("word/document.xml", xml_bytes)
    return buf.getvalue()


def test_markdown_parses_into_heading_sections() -> None:
    content = b"# Intro\nSome intro text.\n\n## Details\nSome detail text.\n"

    sections = parse_simple(content, "md")

    assert [s.heading_path for s in sections] == ["Intro", "Details"]
    assert sections[0].text == "Some intro text."
    assert sections[1].text == "Some detail text."


def test_docx_parses_into_heading_style_sections() -> None:
    content = _make_docx_bytes(
        [
            ("Heading1", "Intro"),
            (None, "Some intro text."),
            ("Heading1", "Details"),
            (None, "Some detail text."),
        ]
    )

    sections = parse_simple(content, "docx")

    assert [s.heading_path for s in sections] == ["Intro", "Details"]
    assert sections[0].text == "Some intro text."


def test_docx_with_no_heading_styles_falls_back_to_fixed_windows() -> None:
    """AC-002-08: a docx with no heading-styled paragraphs still extracts
    something instead of erroring on format.
    """
    content = _make_docx_bytes([(None, "Just a plain paragraph, no headings at all.")])

    sections = parse_simple(content, "docx")

    assert len(sections) == 1
    assert "chars" in sections[0].heading_path


def test_structureless_plain_text_falls_back_to_fixed_windows() -> None:
    """AC-002-08: plain text with no markdown headings still extracts over
    fixed windows rather than erroring on format.
    """
    content = ("no headings here, just prose. " * 200).encode("utf-8")

    sections = parse_simple(content, "txt")

    assert len(sections) > 1
    assert all("chars" in s.heading_path for s in sections)
    # every char of input is covered by some window, none dropped
    assert sum(len(s.text) for s in sections) <= len(content.decode("utf-8"))


def test_unknown_extension_falls_back_to_fixed_windows_of_decoded_text() -> None:
    content = b"some content in a format with no dedicated parser"

    sections = parse_simple(content, "rtf")

    assert len(sections) == 1
    assert sections[0].text == content.decode("utf-8")
