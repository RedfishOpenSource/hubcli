from __future__ import annotations

from importlib import import_module

COMMAND_MODULES = {
    'xmind': 'hubcli_worker.commands.xmind',
    'md': 'hubcli_worker.commands.md',
    'arthas': 'hubcli_worker.commands.arthas',
    'rabbitmq': 'hubcli_worker.commands.rabbitmq',
    'rocketmq4': 'hubcli_worker.commands.rocketmq4',
    'mqtt': 'hubcli_worker.commands.mqtt',
    'minio': 'hubcli_worker.commands.minio',
    'nacos': 'hubcli_worker.commands.nacos',
    'mysql': 'hubcli_worker.commands.mysql',
}


def get_handler(command: str) -> object | None:
    module_name = COMMAND_MODULES.get(command)
    if not module_name:
        return None
    module = import_module(module_name)
    return getattr(module, 'handle', None)
