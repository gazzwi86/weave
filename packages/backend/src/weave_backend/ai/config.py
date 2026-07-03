"""Single source of truth for tier -> model ID (AC-4). Nothing outside this
module names a Claude model ID.
"""

MODEL_ROUTING_TABLE: dict[str, str] = {
    "fable": "claude-fable-5",
    "sonnet": "claude-sonnet-5",
}
