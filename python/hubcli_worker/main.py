from __future__ import annotations

import json
import sys

from hubcli_worker.registry import get_handler


def _success(result: dict) -> None:
    json.dump({"ok": True, "result": result}, sys.stdout, ensure_ascii=False)


def _failure(message: str, code: str = "worker_error") -> None:
    json.dump({"ok": False, "error": {"code": code, "message": message}}, sys.stdout, ensure_ascii=False)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        command = payload["command"]
        args = payload.get("args", {})
        handler = get_handler(command)

        if handler is None:
            _failure(f"Unsupported command: {command}", "unsupported_command")
            return 2

        result = handler(args)
        _success(result)
        return 0
    except FileNotFoundError as error:
        _failure(str(error), "file_not_found")
        return 2
    except ModuleNotFoundError as error:
        _failure(f"Missing Python dependency: {error}", "missing_dependency")
        return 3
    except Exception as error:
        _failure(str(error))
        return 4


if __name__ == "__main__":
    raise SystemExit(main())
