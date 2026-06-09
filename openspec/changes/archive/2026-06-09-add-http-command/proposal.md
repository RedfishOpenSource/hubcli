## Why

`hubcli` 目前缺少一个内置的 HTTP 请求能力，用户做接口测试时需要依赖外部工具或临时脚本。现在补上 `hubcli http`，可以同时覆盖临时请求和工程化请求配置两类常见场景，并保持与现有命令分组风格一致。

## What Changes

- Add a new `http` command group to support lightweight API testing from the CLI.
- Support direct ad hoc HTTP requests with `hubcli http send <url>`.
- Support executing JSON request definitions with `hubcli http run <name-or-path>`.
- Support nested request directories under the default `./http` root.
- Support listing executable request definitions with `hubcli http list [path]` while excluding example files.
- Support scaffolding an HTTP request workspace with `hubcli http init [path]`, generating example-only files for requests, environments, and usage guidance.
- Support environment-based and CLI-provided variable substitution for request definitions.
- Allow `run` to accept either a logical request name resolved under the request root or a direct `.http.json` file path outside the root.

## Capabilities

### New Capabilities
- `http-command`: Add direct HTTP requests, file-based request execution, request listing, and example workspace initialization for API testing workflows.

### Modified Capabilities
- None.

## Impact

- Adds a new Node.js command group under `src/commands/http/` and registers it in the CLI command registry.
- Introduces request file discovery, JSON schema validation, environment loading, variable substitution, and HTTP execution logic in the Node runtime.
- Adds new help and behavior coverage for `send`, `run`, `list`, and `init` flows, including nested path resolution and exclusion of example files.
- Does not require a new Python worker command or new external service dependency for v1.
