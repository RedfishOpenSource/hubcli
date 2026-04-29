from __future__ import annotations

from hubcli_worker.tasks.mysql.operations import run_operation


def handle(args: dict) -> object:
    operation = args.get("operation")
    options = args.get("options") or {}
    if not operation:
        raise ValueError("Missing MySQL operation.")
    return run_operation(operation, options)
