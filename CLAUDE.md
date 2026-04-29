# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Status

- The repository now contains an initial implementation scaffold for `hubcli`.
- The current toolchain is split between a Node.js CLI package and a Python worker package.
- The current user-facing commands are `xmind`, `md`, `doctor`, and the grouped `rabbitmq`, `rocketmq4`, `mqtt`, `minio`, `nacos`, and `mysql` commands.

## Commands

### Node.js

- Install Node dependencies: `npm install`
- Run CLI locally: `npm run dev -- --help`
- Check basic command wiring: `npm run test:help`
- Run dependency check: `npm run doctor`
- Prepare package for global installation testing: `npm pack`

### Python

- Ensure Python 3.11+ is available on `PATH`
- The bundled worker runs directly from `python/hubcli_worker`

### Browser Rendering

- Install the Playwright browser used by `hubcli md`: `npx playwright install chromium`

## Architecture

- `bin/hubcli.js` is the executable entrypoint exposed through the npm `bin` field.
- `src/cli.js` is now a thin CLI bootstrap.
- `src/core/command-registry.js` registers commands and command groups with Commander.
- `src/core/execute-command.js` runs commands by runtime mode: `node`, `python`, or `hybrid`.
- `src/core/python-bridge.js` is the boundary layer between Node.js and Python.
- `src/core/paths.js` stores shared path and extension helpers.
- `src/commands/<name>/index.js` stores one user-facing command or command group per directory.
- `python/hubcli_worker/main.py` is the generic Python worker entrypoint invoked as a subprocess.
- `python/hubcli_worker/registry.py` maps worker command names to Python handlers.
- `python/hubcli_worker/commands/<name>.py` stores thin Python command adapters.
- `python/hubcli_worker/tasks/xmind_to_md.py` converts `.xmind` files into Markdown.
- `python/hubcli_worker/tasks/md_prepare.py` prepares Markdown content for the PDF rendering pipeline.
- `python/hubcli_worker/tasks/rabbitmq/` stores RabbitMQ management and AMQP task logic.
- `python/hubcli_worker/tasks/rocketmq4/` stores native RocketMQ 4.x topic query and message send task logic.
- `python/hubcli_worker/tasks/mqtt/` stores generic MQTT protocol task logic.
- `python/hubcli_worker/tasks/minio/` stores MinIO bucket and object task logic.
- `python/hubcli_worker/tasks/nacos/` stores Nacos query task logic.
- `python/hubcli_worker/tasks/mysql/` stores MySQL query, execution, and export task logic.
- `src/render/html-template.js` injects document styling and Mermaid rendering support.

## Command Organization

- Add future command groups under `src/commands/<name>/index.js`.
- If a command needs Python, add a matching adapter under `python/hubcli_worker/commands/<name>.py`.
- Keep reusable Python business logic in `python/hubcli_worker/tasks/` rather than in worker entrypoints.
- Avoid growing `src/cli.js` or `python/hubcli_worker/main.py` into large routing files again.

## Integration Contract

- Node.js launches Python as a subprocess.
- Node.js sends JSON payloads over standard input.
- Python returns JSON over standard output.
- Standard error is reserved for diagnostics.
- Exit codes distinguish success, dependency failures, validation errors, and worker failures.

## Current Product Assumptions

- Global install is performed with `npm install -g hubcli`.
- The runtime assumes Python 3.11+ is already installed and available on `PATH`.
- Markdown-to-PDF currently supports Mermaid fenced code blocks, specifically `flowchart` and `erDiagram`.
- XMind conversion currently targets `.xmind` input files and exports a readable Markdown hierarchy.

## Notes For Future Updates

- If the worker or renderer changes, keep the Node/Python responsibility split explicit in this file.
- If packaging changes, update both the install commands and the runtime assumptions.
- Keep this file concise and tied to the actual code layout in the repository.
