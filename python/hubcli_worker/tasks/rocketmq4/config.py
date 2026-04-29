from __future__ import annotations

import os

from hubcli_worker.tasks.rocketmq4.models import RocketMqRuntime


def build_rocketmq_runtime(options: dict) -> RocketMqRuntime:
    timeout = float(options.get('timeout') or 10)
    if timeout <= 0:
        raise ValueError('RocketMQ timeout must be greater than 0 seconds.')

    namesrv = options.get('namesrv') or os.getenv('HUBCLI_ROCKETMQ_NAMESRV')
    return RocketMqRuntime(namesrv=namesrv.strip() if isinstance(namesrv, str) and namesrv.strip() else None, timeout=timeout)
