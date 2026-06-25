"""Ollama LLM provider for local development.

Uses Ollama's JSON-schema ``format`` parameter (GBNF grammar-constrained output)
as a substitute for Claude's ``tool_choice`` mechanism — Ollama's OpenAI-compat
endpoint does not support ``tool_choice``.

Recommended models (good structured-output adherence):
- qwen2.5-coder:32b  (best quality; needs ~20 GB VRAM / 32 GB M-series RAM)
- qwen2.5-coder:14b  (good quality; needs ~10 GB)

Caveats vs Claude:
- Enum adherence is structural (grammar), not semantic — the model may pick a
  valid-but-wrong kind; the SHACL gate in apply_operations is the safety net.
- Always pass num_ctx=32768; default 4096 silently truncates large ontologies.
- No tool_choice → no guaranteed single-call format; the grammar forces JSON but
  the model occasionally wraps it in markdown; the parser strips those fences.
"""

from __future__ import annotations

import json
import re
from typing import Any

from .service import MUTATION_TOOL, build_system_prompt


class OllamaService:
    """Thin Ollama client that mirrors the LLMService.propose() interface."""

    def __init__(self, url: str, model: str, num_ctx: int = 32768) -> None:
        self._url = url.rstrip("/")
        self._model = model
        self._num_ctx = num_ctx

    def propose(
        self, prompt: str, graph: dict[str, list[dict[str, Any]]]
    ) -> tuple[str, list[dict[str, Any]]]:
        """Ask Ollama to propose graph mutations; returns (message, operations)."""
        import urllib.error
        import urllib.request

        system = build_system_prompt(graph)
        schema = MUTATION_TOOL["input_schema"]
        body = json.dumps(
            {
                "model": self._model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt},
                ],
                "format": schema,
                "options": {"num_ctx": self._num_ctx},
                "stream": False,
            }
        ).encode()

        req = urllib.request.Request(
            f"{self._url}/api/chat",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:  # noqa: S310
                raw = json.loads(resp.read())
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Ollama request failed: {exc}") from exc

        content = raw.get("message", {}).get("content", "")
        return _parse_ollama_response(content)

    def generate_sparql(self, question: str, system_prompt: str) -> str:
        """Ask Ollama to generate a SPARQL query (text output, no grammar)."""
        import urllib.error
        import urllib.request

        body = json.dumps(
            {
                "model": self._model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question},
                ],
                "stream": False,
            }
        ).encode()
        req = urllib.request.Request(
            f"{self._url}/api/chat",
            data=body,
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310
                raw = json.loads(resp.read())
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Ollama request failed: {exc}") from exc

        text = raw.get("message", {}).get("content", "").strip()
        # Strip markdown fences if present.
        text = re.sub(r"^```[a-z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        return text.strip()


def _parse_ollama_response(content: str) -> tuple[str, list[dict[str, Any]]]:
    """Parse the JSON payload from Ollama's text response."""
    content = content.strip()
    # Strip any accidental markdown fences.
    content = re.sub(r"^```[a-z]*\n?", "", content)
    content = re.sub(r"\n?```$", "", content)
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return "Could not parse Ollama response.", []
    return data.get("message", ""), data.get("operations", [])
