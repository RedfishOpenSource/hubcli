from __future__ import annotations

from hubcli_worker.tasks.nacos.operations import run_operation


def handle(args: dict) -> object:
    operation = args.get("operation")
    options = args.get("options") or {}
    if not operation:
        raise ValueError("Missing Nacos operation.")
    return run_operation(operation, options)
