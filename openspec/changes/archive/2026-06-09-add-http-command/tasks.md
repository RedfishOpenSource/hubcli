## 1. Command surface and module wiring

- [x] 1.1 Register the new `http` command group in the CLI command registry
- [x] 1.2 Create the `send`, `run`, `list`, and `init` subcommand definitions under `src/commands/http/`
- [x] 1.3 Add shared option definitions and argument parsing helpers for HTTP command inputs

## 2. Request model and execution

- [x] 2.1 Implement request option normalization for methods, headers, query parameters, body, timeout, and output settings
- [x] 2.2 Implement direct HTTP execution for `hubcli http send <url>` in the Node runtime
- [x] 2.3 Implement structured result formatting with a machine-friendly `--json` output mode

## 3. File-based request resolution

- [x] 3.1 Implement logical-name resolution from the default `./http` root to nested `*.http.json` files
- [x] 3.2 Implement explicit file-path handling for executable `.http.json` files outside the request root
- [x] 3.3 Implement filtering rules that reject `*.example.http.json` files from `run`
- [x] 3.4 Implement `list` scanning that includes only executable request definitions and excludes example files

## 4. Configuration loading and templating

- [x] 4.1 Implement JSON schema validation for executable request definition files
- [x] 4.2 Implement environment file loading from `<root>/env/<name>.json`
- [x] 4.3 Implement `{{name}}` placeholder substitution for request strings using environment data and repeated `--var` overrides
- [x] 4.4 Implement merge rules for runtime overrides from `--header`, `--query`, `--timeout`, and `--var`

## 5. Workspace initialization and examples

- [x] 5.1 Implement `hubcli http init [path]` to create the request root and nested example structure
- [x] 5.2 Generate example request files using the `*.example.http.json` naming pattern
- [x] 5.3 Generate example environment files using the `*.example.json` naming pattern
- [x] 5.4 Generate example usage guidance that explains how to convert examples into runnable request files

## 6. Verification

- [x] 6.1 Add command help coverage for the new `http` command group and subcommands
- [x] 6.2 Add tests for direct request execution argument handling and result formatting
- [x] 6.3 Add tests for logical-name resolution, nested directory support, and explicit file-path execution
- [x] 6.4 Add tests ensuring example files are excluded from both `run` and `list`
- [x] 6.5 Add tests for environment loading, variable substitution, and initialization output
