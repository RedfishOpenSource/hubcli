from __future__ import annotations

from pathlib import Path

from hubcli_worker.tasks.md_prepare import prepare_markdown


def handle(args: dict) -> dict:
    return prepare_markdown(Path(args["inputPath"]))
