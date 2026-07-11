"""CE-V1-TASK-013 / ADR-011 pin 1a: simple structure parse only -- markdown
heading tree for text/markdown, style-based heading tree for docx (stdlib
zipfile+ElementTree, no new dependency for a well-documented zip+XML
format), page-boundary text for PDF (`pypdf`, text extraction only -- no
layout/table reconstruction). Structureless text (or any format with no
detected headings) falls back to fixed-size windows so extraction still has
*something* to work with (AC-002-08).
"""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from io import BytesIO
from xml.etree import (
    ElementTree,  # nosec B405 -- trusted upload path, own artefact (see B314 below)
)

from pypdf import PdfReader

#: ADR-011 pin 1a fallback window size when no heading structure is found.
_FIXED_WINDOW_CHARS = 2000

_MD_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+)$")
_DOCX_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_DOCX_HEADING_STYLES = {f"Heading{i}" for i in range(1, 7)} | {f"heading {i}" for i in range(1, 7)}


@dataclass(frozen=True)
class Section:
    """One parsed chunk of a document -- `heading_path` doubles as the
    proposal's `source_span` locator (AC-002-01's pitfall: persist this now,
    TASK-014 citations depend on it).
    """

    heading_path: str
    text: str


def _window_section(index: int, chunk: str) -> Section:
    start = index * _FIXED_WINDOW_CHARS
    return Section(heading_path=f"chars {start}-{start + len(chunk)}", text=chunk)


def _fixed_windows(text: str) -> list[Section]:
    chunks = [text[i : i + _FIXED_WINDOW_CHARS] for i in range(0, len(text), _FIXED_WINDOW_CHARS)]
    sections = [_window_section(i, c) for i, c in enumerate(chunks) if c.strip()]
    return sections or [Section(heading_path="chars 0-0", text="")]


def _parse_markdown_headings(text: str) -> list[Section] | None:
    sections: list[Section] = []
    heading: str | None = None
    body: list[str] = []
    for line in text.splitlines():
        match = _MD_HEADING_RE.match(line)
        if match:
            if heading is not None:
                sections.append(Section(heading_path=heading, text="\n".join(body).strip()))
            heading, body = match.group(2).strip(), []
        elif heading is not None:
            body.append(line)
    if heading is not None:
        sections.append(Section(heading_path=heading, text="\n".join(body).strip()))
    return sections or None


def _docx_paragraphs(content: bytes) -> list[tuple[str | None, str]]:
    """Yields `(heading_style_or_None, paragraph_text)` for every paragraph
    in `word/document.xml` -- a docx is a zip of XML parts (OOXML), no
    binary parsing library needed.
    """
    with zipfile.ZipFile(BytesIO(content)) as archive:
        xml_bytes = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml_bytes)  # noqa: S314  # nosec B314 -- trusted upload path, own artefact
    paragraphs = []
    for para in root.iter(f"{_DOCX_NS}p"):
        style_el = para.find(f"{_DOCX_NS}pPr/{_DOCX_NS}pStyle")
        style = style_el.get(f"{_DOCX_NS}val") if style_el is not None else None
        text = "".join(t.text or "" for t in para.iter(f"{_DOCX_NS}t"))
        paragraphs.append((style, text))
    return paragraphs


def _parse_docx_headings(content: bytes) -> list[Section] | None:
    sections: list[Section] = []
    heading: str | None = None
    body: list[str] = []
    for style, text in _docx_paragraphs(content):
        if style in _DOCX_HEADING_STYLES:
            if heading is not None:
                sections.append(Section(heading_path=heading, text="\n".join(body).strip()))
            heading, body = text.strip(), []
        elif heading is not None:
            body.append(text)
    if heading is not None:
        sections.append(Section(heading_path=heading, text="\n".join(body).strip()))
    return sections or None


def _parse_pdf_pages(content: bytes) -> list[Section]:
    reader = PdfReader(BytesIO(content))
    return [
        Section(heading_path=f"page {i + 1}", text=page.extract_text() or "")
        for i, page in enumerate(reader.pages)
    ]


def parse_simple(content: bytes, ext: str) -> list[Section]:
    """AC-002-01/-08: simple structure parse per format, fixed-window
    fallback for anything with no detected heading structure. `ext` is the
    upload's file extension (already lower-cased by the caller).
    """
    if ext == "pdf":
        pages = _parse_pdf_pages(content)
        combined = "\n".join(p.text for p in pages)
        return pages if any(p.text.strip() for p in pages) else _fixed_windows(combined)
    if ext == "docx":
        text = "\n".join(t for _, t in _docx_paragraphs(content))
        return _parse_docx_headings(content) or _fixed_windows(text)
    text = content.decode("utf-8", errors="replace")
    if ext == "md":
        return _parse_markdown_headings(text) or _fixed_windows(text)
    return _fixed_windows(text)
