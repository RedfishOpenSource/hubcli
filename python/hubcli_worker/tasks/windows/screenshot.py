from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def _normalize_monitor(monitor: object) -> int | None:
    if monitor is None:
        return None
    if not isinstance(monitor, int) or monitor < 1:
        raise ValueError('Expected monitor to be a positive integer.')
    return monitor


def _run_powershell_capture(output_path: Path, *, monitor: int | None, capture_all: bool) -> dict:
    script = r'''
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$outputPath = $env:HUBCLI_SCREENSHOT_OUTPUT
$captureAll = $env:HUBCLI_SCREENSHOT_ALL -eq '1'
$monitorText = $env:HUBCLI_SCREENSHOT_MONITOR
$screens = [System.Windows.Forms.Screen]::AllScreens
if ($screens.Count -lt 1) {
    Write-Output 'No Windows screens are available.'
    exit 3
}
if ($captureAll) {
    $bounds = [System.Drawing.Rectangle]::Empty
    foreach ($screen in $screens) {
        $bounds = [System.Drawing.Rectangle]::Union($bounds, $screen.Bounds)
    }
    $monitorIndex = 0
} elseif ([string]::IsNullOrWhiteSpace($monitorText)) {
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $monitorIndex = 1
} else {
    $monitorIndex = [int]$monitorText
    if ($monitorIndex -lt 1 -or $monitorIndex -gt $screens.Count) {
        Write-Output "Monitor $monitorIndex is not available. Found $($screens.Count) monitor(s)."
        exit 3
    }
    $bounds = $screens[$monitorIndex - 1].Bounds
}
$directory = [System.IO.Path]::GetDirectoryName($outputPath)
if (-not [string]::IsNullOrWhiteSpace($directory)) {
    [System.IO.Directory]::CreateDirectory($directory) | Out-Null
}
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
try {
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $graphics.Dispose()
    $bitmap.Dispose()
}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
@{
    outputPath = $outputPath
    monitor = $monitorIndex
    width = $bounds.Width
    height = $bounds.Height
} | ConvertTo-Json -Compress
'''
    env = {
        'HUBCLI_SCREENSHOT_OUTPUT': str(output_path),
        'HUBCLI_SCREENSHOT_ALL': '1' if capture_all else '0',
        'HUBCLI_SCREENSHOT_MONITOR': '' if monitor is None else str(monitor),
    }
    with tempfile.NamedTemporaryFile('w', suffix='.ps1', delete=False, encoding='utf-8') as script_file:
        script_file.write(script)
        script_path = Path(script_file.name)
    try:
        result = subprocess.run(
            ['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(script_path)],
            check=False,
            capture_output=True,
            env={**os.environ, **env},
            text=True,
            timeout=30,
        )
    finally:
        script_path.unlink(missing_ok=True)
    if result.returncode != 0:
        stderr = result.stderr or ''
        stdout = result.stdout or ''
        message = stderr.strip() or stdout.strip() or 'PowerShell screenshot capture failed.'
        raise ValueError(message)
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise ValueError(f'Failed to parse screenshot result: {result.stdout}') from error
    return data


def capture_screenshot(output_path: Path, *, monitor: object = None, capture_all: bool = False) -> dict:
    if sys.platform != 'win32':
        raise ValueError('Windows screenshot is only supported on Windows.')

    output_path.parent.mkdir(parents=True, exist_ok=True)
    selected_monitor = _normalize_monitor(monitor)
    result = _run_powershell_capture(output_path, monitor=selected_monitor, capture_all=capture_all)

    return {
        'outputPath': result['outputPath'],
        'monitor': result['monitor'],
        'width': result['width'],
        'height': result['height'],
    }
