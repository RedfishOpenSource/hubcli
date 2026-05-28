from __future__ import annotations

from pathlib import Path

from hubcli_worker.tasks.windows.screenshot import capture_screenshot


def handle(args: dict) -> dict:
    operation = args.get('operation')
    options = args.get('options') or {}

    if operation == 'screenshot':
        output_path = options.get('outputPath')
        if not output_path:
            raise ValueError('Missing screenshot output path.')
        return capture_screenshot(
            Path(output_path),
            monitor=options.get('monitor'),
            capture_all=bool(options.get('all')),
        )

    if not operation:
        raise ValueError('Missing Windows operation.')
    raise ValueError(f'Unsupported Windows operation: {operation}')
