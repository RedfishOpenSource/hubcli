from __future__ import annotations

from pathlib import Path
import re

MERMAID_PATTERN = re.compile(r"```mermaid\s+[\s\S]*?```", re.MULTILINE)
TITLE_PATTERN = re.compile(r"^#\s+(.+)$", re.MULTILINE)


def prepare_markdown(input_path: Path) -> dict:
    markdown = input_path.read_text(encoding="utf-8")
    title_match = TITLE_PATTERN.search(markdown)
    title = title_match.group(1).strip() if title_match else input_path.stem
    contains_mermaid = bool(MERMAID_PATTERN.search(markdown))

    return {
        "title": title,
        "markdown": markdown,
        "containsMermaid": contains_mermaid,
    }
