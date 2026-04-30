# hubcli

English | [简体中文](./README.zh-CN.md)

`hubcli` is a unified command-line toolkit that uses a Node.js CLI plus Python workers to operate multiple external systems behind one consistent interface.

## Overview

The project is designed to reduce context switching between admin consoles, vendor CLIs, and one-off scripts.

Current command families:

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

## Features

- Single CLI entrypoint for multiple platforms
- Clear Node.js / Python runtime split
- Consistent command grouping and help output
- Local packaging flow for pre-publish validation
- Bundled Arthas runtime with HTTP API based command execution
- Built-in document conversion utilities for XMind and Markdown

## Requirements

- Node.js `20+`
- npm `10+` recommended
- Python `3.11+` available on `PATH`

Check your environment with:

```bash
node --version
npm --version
python --version
```

## Install

### Install from GitHub Releases (Windows)

Download one of these artifacts from GitHub Releases:

- `hubcli-windows-x64-setup.exe` — installs `hubcli` and can add it to `PATH`
- `hubcli-windows-x64-portable.zip` — unzip and run `hubcli.cmd`

For these Windows release artifacts, most commands do not require a local Node.js or Python installation.

Release builds bundle:

- Node.js runtime
- Python worker runtime
- Playwright Chromium for `hubcli md`
- Bundled Arthas assets

Release builds do not bundle Java. Install Java on `PATH` only if you need `hubcli arthas`.

After install, verify with:

```bash
hubcli --help
hubcli doctor
hubcli md --help
```

### Run from source

```bash
npm install
npx playwright install chromium
npm run doctor
npm run dev -- --help
```

### Global install from npm

```bash
npm install -g hubcli
npx playwright install chromium
hubcli doctor
```

This install mode still requires local Python `3.11+` on `PATH` and the Python dependencies declared in `python/pyproject.toml`.

### Global install from a local tarball

```bash
npm pack
npm install -g ./hubcli-<version>.tgz
npx playwright install chromium
hubcli doctor
```

This install mode still requires local Python `3.11+` on `PATH` and the Python dependencies declared in `python/pyproject.toml`.

### Build the Windows installer

On a Windows release machine with PowerShell, Python `3.11+`, and Inno Setup (`iscc`) available on `PATH`:

```powershell
npm run release:windows
```

Artifacts are written to `release/dist/`:

- `hubcli-windows-x64-setup.exe`
- `hubcli-windows-x64-portable.zip`

The release build bundles the Node.js runtime, the PyInstaller-built Python worker, Playwright Chromium, and Arthas assets.

## Uninstall and Repack

### Remove the global install

```bash
npm uninstall -g hubcli
```

This removes both registry installs and installs created from a local `.tgz` package.

### Rebuild the package from the current project

```bash
npm pack
```

The generated tarball is written to the project root, for example `hubcli-<version>.tgz`.

## Quick Start

### Show help

```bash
hubcli --help
```

### Verify runtime dependencies

```bash
hubcli doctor
```

### Run an Arthas command

```bash
hubcli arthas --pid 33692 sc -d com.example.DemoService
hubcli arthas --pid 33692 trace com.example.DemoService run -n 5 --skipJDKMethod false --timeout 30
```

### Convert XMind to Markdown

```bash
hubcli xmind ./examples/sample.xmind ./out/sample.md
```

### Convert Markdown to PDF

```bash
hubcli md ./examples/sample-flowchart.md ./out/flowchart.pdf
hubcli md ./examples/sample-er.md ./out/er.pdf
```

## Command Guide

### `hubcli doctor`

Checks whether the local runtime is ready.

Current checks include:

- Python `3.11+` availability on `PATH`
- bundled Python worker files
- Playwright Chromium availability for PDF export
- RocketMQ4 worker startup and config parsing
- MQTT worker startup and config parsing
- MinIO worker startup and config parsing

### `hubcli xmind <input> <output>`

Converts an `.xmind` file into Markdown.

Behavior:

- reads `.xmind` input
- exports sheets and topics into Markdown hierarchy
- writes the result to the output path
- creates the output directory when needed
- appends `.md` if the output file has no `.md` suffix

### `hubcli md <input> <output>`

Converts a Markdown file into PDF.

Current support:

- standard Markdown content
- Mermaid fenced code blocks
- Mermaid `flowchart`
- Mermaid `erDiagram`

Behavior:

- reads Markdown input
- renders HTML with document styling
- renders Mermaid diagrams in Chromium
- exports PDF to the output path
- creates the output directory when needed
- appends `.pdf` if the output file has no `.pdf` suffix

### `hubcli arthas --pid <pid> <arthasArgs...>`

Runs an Arthas command against a specific JVM process.

Behavior:

- requires an explicit `--pid <pid>`
- keeps remaining arguments as raw Arthas arguments
- requires `hubcli` options such as `--timeout` and `--json` to appear before the Arthas command itself
- bundles Arthas with `hubcli`, but still requires local Java on `PATH`
- uses `arthas-boot` only for the first attach when the target JVM does not already expose Arthas HTTP API
- prefers Arthas HTTP API on `127.0.0.1:8563` for command execution
- runs `sc`, `sm`, `jad`, `ognl`, and other immediate commands through synchronous HTTP `exec`
- runs `trace`, `watch`, `stack`, `tt`, and `monitor` through `init_session`, `async_exec`, and `pull_results`
- returns async command output after the command completes or times out, rather than streaming line-by-line during execution
- interrupts long-running async jobs after `--timeout` and closes the HTTP session after each run
- does not unload Arthas from the target JVM unless you explicitly run `stop`

Recommended workflow:

1. Use `jps -l` to find the target JVM PID.
2. Confirm class or method matching with `sc` or `sm` before running `trace` or `watch`.
3. Start `trace` or `watch` first, then trigger the target request on the same JVM instance.
4. For local Spring Boot services, call the exact local port of the target process to avoid tracing a different instance behind a gateway or load balancer.

Common commands:

```bash
jps -l
hubcli arthas --pid 33692 sc -d com.example.DemoService
hubcli arthas --pid 33692 sm com.example.DemoService run
hubcli arthas --pid 33692 jad com.example.DemoService
hubcli arthas --pid 33692 ognl '@java.lang.System@getProperty("user.dir")'
hubcli arthas --pid 33692 --json watch com.example.DemoService run '{params,returnObj,throwExp}' -x 2 -n 1
hubcli arthas --pid 33692 --timeout 30 trace com.example.DemoService run -n 1 --skipJDKMethod false
```

Local verification example:

```bash
hubcli arthas --pid 33692 --timeout 30 trace com.sinomis.monitorservice.controller.MonitorSystemController listSystems -n 1 --skipJDKMethod false
curl "http://localhost:9995/api/monitor/monitorSystem/open/systemList?tenantId=2012040808986849333"
```

Troubleshooting:

- If `trace` or `watch` prints nothing, make sure the request actually hit the same JVM PID you attached to.
- If class matching works but runtime commands still do not trigger, try tracing the Spring CGLIB proxy class or a lower service-layer method.
- If an async command times out, reduce the scope with a more specific class and method, lower `-n`, or switch to `watch` for a faster sanity check.
- If Java is missing, install Java and make sure `java` is available on `PATH`.

### `hubcli rabbitmq ...`

RabbitMQ management and AMQP operations.

Current subcommand areas:

- `ping`, `whoami`, `overview`
- `cluster`, `vhost`, `connection`, `channel`, `consumer`
- `queue`, `exchange`, `binding`
- `publish`, `consume`
- `definitions`, `user`, `permission`, `policy`

Common environment variables:

- `HUBCLI_RABBITMQ_MGMT_URL`
- `HUBCLI_RABBITMQ_MGMT_USER`
- `HUBCLI_RABBITMQ_MGMT_PASS`
- `HUBCLI_RABBITMQ_AMQP_URL`
- `HUBCLI_RABBITMQ_VHOST`
- `HUBCLI_RABBITMQ_TLS_CA`
- `HUBCLI_RABBITMQ_TLS_CERT`
- `HUBCLI_RABBITMQ_TLS_KEY`

Examples:

```bash
hubcli rabbitmq --help
hubcli rabbitmq overview --mgmt-url http://localhost:15672 --mgmt-user guest --mgmt-pass guest
hubcli rabbitmq queue list --mgmt-url http://localhost:15672 --mgmt-user guest --mgmt-pass guest
hubcli rabbitmq publish --amqp-url amqp://guest:guest@localhost:5672/%2F --exchange "" --routing-key demo.q --body "hello"
hubcli rabbitmq consume --amqp-url amqp://guest:guest@localhost:5672/%2F --queue demo.q --max-messages 1 --ack
```

### `hubcli rocketmq4 ...`

Native RocketMQ 4.x topic and message operations.

Current subcommand areas:

- `ping`
- `topic list`
- `topic route <topicName>`
- `message send <topicName>`

Common environment variables:

- `HUBCLI_ROCKETMQ_NAMESRV`

Examples:

```bash
hubcli rocketmq4 --help
hubcli rocketmq4 ping --namesrv 127.0.0.1:9876
hubcli rocketmq4 topic list --namesrv 127.0.0.1:9876
hubcli rocketmq4 topic route TopicTest --namesrv 127.0.0.1:9876
hubcli rocketmq4 message send TopicTest --namesrv 127.0.0.1:9876 --body "hello"
```

### `hubcli mqtt ...`

Generic MQTT protocol operations.

Current subcommand areas:

- `ping`
- `publish <topic>`
- `subscribe <topicFilter>`
- `session info`
- `retained get <topic>`
- `retained clear <topic>`

Common environment variables:

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

Examples:

```bash
hubcli mqtt --help
hubcli mqtt ping --host 127.0.0.1 --port 1883
hubcli mqtt publish demo/topic --host 127.0.0.1 --body "hello"
hubcli mqtt subscribe demo/topic --host 127.0.0.1 --max-messages 1
hubcli mqtt retained get demo/topic --host 127.0.0.1
hubcli mqtt retained clear demo/topic --host 127.0.0.1
```

### `hubcli minio ...`

MinIO bucket and object operations.

Current subcommand areas:

- `ping`
- `bucket list`, `bucket stat`, `bucket create`, `bucket delete`
- `object list`, `object stat`, `object get`, `object put`, `object delete`

Common environment variables:

- `HUBCLI_MINIO_ENDPOINT`
- `HUBCLI_MINIO_ACCESS_KEY`
- `HUBCLI_MINIO_SECRET_KEY`
- `HUBCLI_MINIO_REGION`
- `HUBCLI_MINIO_TIMEOUT`
- `HUBCLI_MINIO_TLS_CA`
- `HUBCLI_MINIO_TLS_CERT`
- `HUBCLI_MINIO_TLS_KEY`

Examples:

```bash
hubcli minio --help
hubcli minio ping --endpoint http://localhost:9000 --access-key minioadmin --secret-key minioadmin
hubcli minio bucket list --endpoint http://localhost:9000 --access-key minioadmin --secret-key minioadmin
hubcli minio object list application --endpoint http://localhost:9000 --access-key minioadmin --secret-key minioadmin --prefix logs/
```

### `hubcli nacos ...`

Read-oriented Nacos query operations.

Current subcommand areas:

- `ping`
- `server info`
- `namespace list`, `namespace get`
- `config list`, `config get`
- `service list`, `service get`
- `instance list`

Common environment variables:

- `HUBCLI_NACOS_SERVER`
- `HUBCLI_NACOS_USERNAME`
- `HUBCLI_NACOS_PASSWORD`
- `HUBCLI_NACOS_NAMESPACE`
- `HUBCLI_NACOS_GROUP`
- `HUBCLI_NACOS_TIMEOUT`
- `HUBCLI_NACOS_TLS_CA`
- `HUBCLI_NACOS_TLS_CERT`
- `HUBCLI_NACOS_TLS_KEY`

Examples:

```bash
hubcli nacos --help
hubcli nacos ping --server http://localhost:8848 --username nacos --password nacos
hubcli nacos namespace list --server http://localhost:8848 --username nacos --password nacos
hubcli nacos config get --server http://localhost:8848 --username nacos --password nacos --namespace public --data-id example.yaml --group DEFAULT_GROUP
hubcli nacos service list --server http://localhost:8848 --username nacos --password nacos --namespace public
```

### `hubcli mysql ...`

MySQL query, execution, and export operations.

Current subcommand areas:

- `ping`
- `database list`
- `table list`
- `query run`, `query cross`
- `exec run`
- `export query`, `export dump`

Common environment variables:

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

Examples:

```bash
hubcli mysql --help
hubcli mysql ping --host 127.0.0.1 --port 3306 --user root --pass secret
hubcli mysql database list --host 127.0.0.1 --port 3306 --user root --pass secret
hubcli mysql query run --host 127.0.0.1 --port 3306 --user root --pass secret --database app_db --sql "SELECT * FROM users" --limit 20
hubcli mysql export query --host 127.0.0.1 --port 3306 --user root --pass secret --database app_db --sql "SELECT * FROM users" --format csv --output ./out/users.csv
```

## Packaging Notes

- The published CLI entrypoint is `bin/hubcli.js`
- The Node side dispatches commands and launches Python as a subprocess
- The Python worker entrypoint is `python/hubcli_worker/main.py`
- JSON is exchanged over standard input and output
- Standard error is reserved for diagnostics

## Repository Layout

- `bin/hubcli.js` — executable entrypoint
- `src/cli.js` — thin CLI bootstrap
- `src/core/command-registry.js` — command registration
- `src/core/execute-command.js` — runtime execution by mode
- `src/core/python-bridge.js` — Node/Python boundary
- `src/commands/<name>/index.js` — command definitions
- `python/hubcli_worker/main.py` — generic Python worker entrypoint
- `python/hubcli_worker/registry.py` — worker command registry
- `python/hubcli_worker/tasks/` — reusable Python task logic
- `src/render/html-template.js` — document rendering template

## Troubleshooting

### Python is not available

Install Python `3.11+` and make sure `python` is available on `PATH`.

### Java is not available for Arthas

Install Java and make sure `java` is available on `PATH` before using `hubcli arthas`.

### Chromium is missing

Install Playwright Chromium with:

```bash
npx playwright install chromium
```

### Python integration dependencies are missing

The Python worker depends on packages declared in `python/pyproject.toml`. Install them in the active Python environment before using RabbitMQ, RocketMQ4, MQTT, MinIO, Nacos, or MySQL related commands.
