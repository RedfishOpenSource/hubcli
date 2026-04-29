from __future__ import annotations

from pathlib import Path

from hubcli_worker.tasks.xmind_to_md import convert_xmind_to_markdown


def handle(args: dict) -> dict:
    return convert_xmind_to_markdown(Path(args["inputPath"]), Path(args["outputPath"]))
