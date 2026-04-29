from __future__ import annotations

import os
from pathlib import Path

project_root = Path(os.environ.get('HUBCLI_BUILD_PROJECT_ROOT', Path.cwd())).resolve()
worker_root = project_root / 'python'
entrypoint = worker_root / 'hubcli_worker' / 'main.py'
arthas_vendor = worker_root / 'hubcli_worker' / 'vendor' / 'arthas'

hiddenimports = [
    'hubcli_worker.commands.arthas',
    'hubcli_worker.commands.md',
    'hubcli_worker.commands.minio',
    'hubcli_worker.commands.mqtt',
    'hubcli_worker.commands.mysql',
    'hubcli_worker.commands.nacos',
    'hubcli_worker.commands.rabbitmq',
    'hubcli_worker.commands.rocketmq4',
    'hubcli_worker.commands.xmind',
    'hubcli_worker.tasks.arthas.boot',
    'hubcli_worker.tasks.arthas.http_client',
    'hubcli_worker.tasks.arthas.models',
    'hubcli_worker.tasks.arthas.operations',
    'hubcli_worker.tasks.arthas.runtime',
]

datas = [
    (str(arthas_vendor), 'vendor/arthas'),
]

pathex = [str(worker_root)]


a = Analysis(
    [str(entrypoint)],
    pathex=pathex,
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='hubcli-worker',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='hubcli-worker',
)
