# hubcli

[English](./README.md) | 简体中文

`hubcli` 是一个统一入口的命令行工具，采用 Node.js CLI + Python Worker 的方式，把多个外部系统的常用操作收敛到一套一致的命令接口中。

## 项目概览

这个项目的目标是减少在管理后台、厂商 CLI、临时脚本之间来回切换的成本。

当前命令族包括：

- `hubcli xmind <input> <output>`
- `hubcli md <input> <output>`
- `hubcli doctor`
- `hubcli arthas --pid <pid> <arthasArgs...>`
- `hubcli rabbitmq ...`
- `hubcli rocketmq4 ...`
- `hubcli mqtt ...`
- `hubcli minio ...`
- `hubcli nacos ...`
- `hubcli mysql ...`

## 主要特性

- 一个 CLI 入口覆盖多个系统
- 明确的 Node.js / Python 职责边界
- 一致的命令分组与帮助输出
- 支持本地打包验证发布流程
- 内置 Arthas runtime，并优先通过 HTTP API 执行命令
- 内置 XMind 和 Markdown 文档转换能力

## 环境要求

- Node.js `20+`
- 建议 npm `10+`
- Python `3.11+`，并可通过 `PATH` 找到

可先检查环境：

```bash
node --version
npm --version
python --version
```

## 安装方式

### 从 GitHub Releases 安装（Windows）

从 GitHub Releases 下载以下任一产物：

- `hubcli-windows-x64-setup.exe` — 安装版，可选择加入 `PATH`
- `hubcli-windows-x64-portable.zip` — 便携版，解压后运行 `hubcli.cmd`

Release 安装包内置了：

- Node.js runtime
- Python Worker runtime
- `hubcli md` 所需的 Playwright Chromium
- 随包分发的 Arthas 资源

Release 安装包不内置 Java。只有在需要使用 `hubcli arthas` 时，才需要本机 `PATH` 上存在 Java。

安装完成后可先执行：

```bash
hubcli --help
hubcli doctor
```

### 基于源码运行

```bash
npm install
npx playwright install chromium
npm run doctor
npm run dev -- --help
```

### 从 npm 全局安装

```bash
npm install -g hubcli
npx playwright install chromium
hubcli doctor
```

### 从本地 tarball 全局安装

```bash
npm pack
npm install -g ./hubcli-0.1.0.tgz
npx playwright install chromium
hubcli doctor
```

## 卸载与重新打包

### 卸载全局安装

```bash
npm uninstall -g hubcli
```

这个命令同时适用于：

- 从 npm 仓库安装的版本
- 从本地 `.tgz` 包安装的版本

### 基于当前项目重新打包

```bash
npm pack
```

打包结果会输出到项目根目录，例如 `hubcli-0.1.0.tgz`。

## 快速开始

### 查看帮助

```bash
hubcli --help
```

### 检查运行环境

```bash
hubcli doctor
```

### 执行 Arthas 命令

```bash
hubcli arthas --pid 33692 sc -d com.example.DemoService
hubcli arthas --pid 33692 trace com.example.DemoService run -n 5 --skipJDKMethod false --timeout 30
```

### XMind 转 Markdown

```bash
hubcli xmind ./examples/sample.xmind ./out/sample.md
```

### Markdown 转 PDF

```bash
hubcli md ./examples/sample-flowchart.md ./out/flowchart.pdf
hubcli md ./examples/sample-er.md ./out/er.pdf
```

## 命令说明

### `hubcli doctor`

用于检查本地运行环境是否就绪。

当前检查项包括：

- `PATH` 上是否存在 Python `3.11+`
- 内置 Python Worker 文件是否完整
- Playwright Chromium 是否可用于 PDF 导出
- RocketMQ4 Worker 是否能启动并解析配置
- MQTT Worker 是否能启动并解析配置
- MinIO Worker 是否能启动并解析配置

### `hubcli xmind <input> <output>`

把 `.xmind` 文件转换为 Markdown。

当前行为：

- 读取 `.xmind` 输入文件
- 将 sheet 与 topic 导出为 Markdown 层级结构
- 把结果写入输出路径
- 输出目录不存在时自动创建
- 输出文件没有 `.md` 后缀时自动补全

### `hubcli md <input> <output>`

把 Markdown 文件转换为 PDF。

当前支持：

- 标准 Markdown 内容
- Mermaid fenced code block
- Mermaid `flowchart`
- Mermaid `erDiagram`

当前行为：

- 读取 Markdown 输入文件
- 渲染 HTML 文档样式
- 在 Chromium 中渲染 Mermaid 图表
- 导出 PDF 到目标路径
- 输出目录不存在时自动创建
- 输出文件没有 `.pdf` 后缀时自动补全

### `hubcli arthas --pid <pid> <arthasArgs...>`

对指定 JVM 进程执行 Arthas 命令。

当前行为：

- 必须显式传入 `--pid <pid>`
- 其余参数按原样作为 Arthas 参数透传
- `--timeout`、`--json` 这类 `hubcli` 自己的选项必须写在 Arthas 命令之前
- `hubcli` 会内置 Arthas，但运行时仍要求本机 `PATH` 上有 Java
- 当目标 JVM 还没有暴露 Arthas HTTP API 时，首次会通过 `arthas-boot` attach 一次
- 命令执行优先走 `127.0.0.1:8563` 上的 Arthas HTTP API
- `sc`、`sm`、`jad`、`ognl` 等即时返回命令走同步 HTTP `exec`
- `trace`、`watch`、`stack`、`tt`、`monitor` 等阻塞型命令走 `init_session`、`async_exec`、`pull_results`
- 异步命令会在执行完成或超时后统一输出结果，而不是执行过程中逐行实时刷出
- 超时后会按 `--timeout` 中断异步任务，并在每次执行结束后关闭 HTTP session
- 除非明确执行 `stop`，否则不会默认从目标 JVM 卸载 Arthas

推荐使用流程：

1. 先通过 `jps -l` 找到目标 JVM 的 PID。
2. 在执行 `trace`、`watch` 之前，先用 `sc` 或 `sm` 确认类和方法能匹配到。
3. 先启动 `trace` 或 `watch`，再去触发目标请求。
4. 对本地 Spring Boot 服务，尽量直接调用目标进程自己的本地端口，避免被网关或负载均衡转发到别的实例。

常用命令：

```bash
jps -l
hubcli arthas --pid 33692 sc -d com.example.DemoService
hubcli arthas --pid 33692 sm com.example.DemoService run
hubcli arthas --pid 33692 jad com.example.DemoService
hubcli arthas --pid 33692 ognl '@java.lang.System@getProperty("user.dir")'
hubcli arthas --pid 33692 --json watch com.example.DemoService run '{params,returnObj,throwExp}' -x 2 -n 1
hubcli arthas --pid 33692 --timeout 30 trace com.example.DemoService run -n 1 --skipJDKMethod false
```

本地联调示例：

```bash
hubcli arthas --pid 33692 --timeout 30 trace com.sinomis.monitorservice.controller.MonitorSystemController listSystems -n 1 --skipJDKMethod false
curl "http://localhost:9995/api/monitor/monitorSystem/open/systemList?tenantId=2012040808986849333"
```

排查建议：

- 如果 `trace` 或 `watch` 没有任何输出，先确认请求是否真的打到了你 attach 的那个 JVM PID。
- 如果 `sc`、`sm` 能匹配成功，但运行时命令仍然不触发，可以尝试 tracing Spring CGLIB 代理类或更底层的 service 方法。
- 如果异步命令超时，可以缩小匹配范围、把 `-n` 调小，或者先改用 `watch` 做快速验证。
- 如果本机没有 Java，请先安装 Java，并确保 `java` 已加入 `PATH`。

### `hubcli rabbitmq ...`

提供 RabbitMQ 管理与 AMQP 消息操作。

当前子命令范围：

- `ping`、`whoami`、`overview`
- `cluster`、`vhost`、`connection`、`channel`、`consumer`
- `queue`、`exchange`、`binding`
- `publish`、`consume`
- `definitions`、`user`、`permission`、`policy`

常用环境变量：

- `HUBCLI_RABBITMQ_MGMT_URL`
- `HUBCLI_RABBITMQ_MGMT_USER`
- `HUBCLI_RABBITMQ_MGMT_PASS`
- `HUBCLI_RABBITMQ_AMQP_URL`
- `HUBCLI_RABBITMQ_VHOST`
- `HUBCLI_RABBITMQ_TLS_CA`
- `HUBCLI_RABBITMQ_TLS_CERT`
- `HUBCLI_RABBITMQ_TLS_KEY`

示例：

```bash
hubcli rabbitmq --help
hubcli rabbitmq overview --mgmt-url http://localhost:15672 --mgmt-user guest --mgmt-pass guest
hubcli rabbitmq queue list --mgmt-url http://localhost:15672 --mgmt-user guest --mgmt-pass guest
hubcli rabbitmq publish --amqp-url amqp://guest:guest@localhost:5672/%2F --exchange "" --routing-key demo.q --body "hello"
hubcli rabbitmq consume --amqp-url amqp://guest:guest@localhost:5672/%2F --queue demo.q --max-messages 1 --ack
```

### `hubcli rocketmq4 ...`

提供原生 RocketMQ 4.x topic 查询与消息发送能力。

当前子命令范围：

- `ping`
- `topic list`
- `topic route <topicName>`
- `message send <topicName>`

常用环境变量：

- `HUBCLI_ROCKETMQ_NAMESRV`

示例：

```bash
hubcli rocketmq4 --help
hubcli rocketmq4 ping --namesrv 127.0.0.1:9876
hubcli rocketmq4 topic list --namesrv 127.0.0.1:9876
hubcli rocketmq4 topic route TopicTest --namesrv 127.0.0.1:9876
hubcli rocketmq4 message send TopicTest --namesrv 127.0.0.1:9876 --body "hello"
```

### `hubcli mqtt ...`

提供通用 MQTT 协议操作能力。

当前子命令范围：

- `ping`
- `publish <topic>`
- `subscribe <topicFilter>`
- `session info`
- `retained get <topic>`
- `retained clear <topic>`

常用环境变量：

- `HUBCLI_MQTT_URL`
- `HUBCLI_MQTT_HOST`
- `HUBCLI_MQTT_PORT`
- `HUBCLI_MQTT_USERNAME`
- `HUBCLI_MQTT_PASSWORD`
- `HUBCLI_MQTT_CLIENT_ID`
- `HUBCLI_MQTT_PROTOCOL_VERSION`
- `HUBCLI_MQTT_KEEPALIVE`
- `HUBCLI_MQTT_SESSION_EXPIRY`
- `HUBCLI_MQTT_TIMEOUT`
- `HUBCLI_MQTT_TLS_CA`
- `HUBCLI_MQTT_TLS_CERT`
- `HUBCLI_MQTT_TLS_KEY`

示例：

```bash
hubcli mqtt --help
hubcli mqtt ping --host 127.0.0.1 --port 1883
hubcli mqtt publish demo/topic --host 127.0.0.1 --body "hello"
hubcli mqtt subscribe demo/topic --host 127.0.0.1 --max-messages 1
hubcli mqtt retained get demo/topic --host 127.0.0.1
hubcli mqtt retained clear demo/topic --host 127.0.0.1
```

### `hubcli minio ...`

提供 MinIO bucket 与 object 操作。

当前子命令范围：

- `ping`
- `bucket list`、`bucket stat`、`bucket create`、`bucket delete`
- `object list`、`object stat`、`object get`、`object put`、`object delete`

常用环境变量：

- `HUBCLI_MINIO_ENDPOINT`
- `HUBCLI_MINIO_ACCESS_KEY`
- `HUBCLI_MINIO_SECRET_KEY`
- `HUBCLI_MINIO_REGION`
- `HUBCLI_MINIO_TIMEOUT`
- `HUBCLI_MINIO_TLS_CA`
- `HUBCLI_MINIO_TLS_CERT`
- `HUBCLI_MINIO_TLS_KEY`

示例：

```bash
hubcli minio --help
hubcli minio ping --endpoint http://localhost:9000 --access-key minioadmin --secret-key minioadmin
hubcli minio bucket list --endpoint http://localhost:9000 --access-key minioadmin --secret-key minioadmin
hubcli minio object list application --endpoint http://localhost:9000 --access-key minioadmin --secret-key minioadmin --prefix logs/
```

### `hubcli nacos ...`

提供偏只读的 Nacos 查询操作。

当前子命令范围：

- `ping`
- `server info`
- `namespace list`、`namespace get`
- `config list`、`config get`
- `service list`、`service get`
- `instance list`

常用环境变量：

- `HUBCLI_NACOS_SERVER`
- `HUBCLI_NACOS_USERNAME`
- `HUBCLI_NACOS_PASSWORD`
- `HUBCLI_NACOS_NAMESPACE`
- `HUBCLI_NACOS_GROUP`
- `HUBCLI_NACOS_TIMEOUT`
- `HUBCLI_NACOS_TLS_CA`
- `HUBCLI_NACOS_TLS_CERT`
- `HUBCLI_NACOS_TLS_KEY`

示例：

```bash
hubcli nacos --help
hubcli nacos ping --server http://localhost:8848 --username nacos --password nacos
hubcli nacos namespace list --server http://localhost:8848 --username nacos --password nacos
hubcli nacos config get --server http://localhost:8848 --username nacos --password nacos --namespace public --data-id example.yaml --group DEFAULT_GROUP
hubcli nacos service list --server http://localhost:8848 --username nacos --password nacos --namespace public
```

### `hubcli mysql ...`

提供 MySQL 查询、执行与导出能力。

当前子命令范围：

- `ping`
- `database list`
- `table list`
- `query run`、`query cross`
- `exec run`
- `export query`、`export dump`

常用环境变量：

- `HUBCLI_MYSQL_HOST`
- `HUBCLI_MYSQL_PORT`
- `HUBCLI_MYSQL_USER`
- `HUBCLI_MYSQL_PASS`
- `HUBCLI_MYSQL_DATABASE`
- `HUBCLI_MYSQL_CHARSET`
- `HUBCLI_MYSQL_TIMEOUT`
- `HUBCLI_MYSQL_TLS_CA`
- `HUBCLI_MYSQL_TLS_CERT`
- `HUBCLI_MYSQL_TLS_KEY`

示例：

```bash
hubcli mysql --help
hubcli mysql ping --host 127.0.0.1 --port 3306 --user root --pass secret
hubcli mysql database list --host 127.0.0.1 --port 3306 --user root --pass secret
hubcli mysql query run --host 127.0.0.1 --port 3306 --user root --pass secret --database app_db --sql "SELECT * FROM users" --limit 20
hubcli mysql export query --host 127.0.0.1 --port 3306 --user root --pass secret --database app_db --sql "SELECT * FROM users" --format csv --output ./out/users.csv
```

## 打包说明

- 对外发布的 CLI 入口是 `bin/hubcli.js`
- Node.js 侧负责命令分发，并以子进程方式启动 Python
- Python Worker 入口是 `python/hubcli_worker/main.py`
- Node 与 Python 之间通过标准输入输出传递 JSON
- 标准错误输出仅用于诊断信息

## 仓库结构

- `bin/hubcli.js` — 可执行入口
- `src/cli.js` — 轻量 CLI 启动层
- `src/core/command-registry.js` — 命令注册中心
- `src/core/execute-command.js` — 按运行模式执行命令
- `src/core/python-bridge.js` — Node / Python 边界层
- `src/commands/<name>/index.js` — 命令定义
- `python/hubcli_worker/main.py` — 通用 Worker 入口
- `python/hubcli_worker/registry.py` — Worker 命令注册表
- `python/hubcli_worker/tasks/` — 可复用 Python 任务逻辑
- `src/render/html-template.js` — 文档渲染模板

## 常见问题

### 找不到 Python

请安装 Python `3.11+`，并确保 `python` 命令已经加入 `PATH`。

### Arthas 运行时找不到 Java

请安装 Java，并确保 `java` 命令已经加入 `PATH`，然后再使用 `hubcli arthas`。

### 缺少 Chromium

请执行：

```bash
npx playwright install chromium
```

### Python 集成依赖未安装

Python Worker 依赖定义在 `python/pyproject.toml` 中。使用 RabbitMQ、RocketMQ4、MQTT、MinIO、Nacos、MySQL 相关命令前，需要先在当前 Python 环境中安装对应依赖。
