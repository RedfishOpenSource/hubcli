## Context

`hubcli` currently offers command groups for several operational domains, but it does not provide a built-in HTTP request workflow for interface testing. The new `http` command group needs to support both ad hoc requests and reusable request definitions while fitting the existing Node-centric command registration model and avoiding unnecessary Python worker expansion.

The repository already separates CLI registration from runtime execution. Existing domain command groups are registered in `src/core/command-registry.js`, and node-only commands can execute entirely in the Node runtime. This change benefits from staying in Node because request file parsing, directory traversal, environment loading, variable substitution, and HTTP execution are all local CLI concerns.

The user has fixed several product constraints for v1:
- The `http` feature uses a group command structure.
- Request configuration files are JSON-only in v1.
- The default request root is `./http`.
- `init` creates example-only files and directory scaffolding.
- Example request files are not executable by `run` and are not shown by `list`.
- `run` accepts either a logical name resolved under the request root or an explicit `.http.json` file path outside the root.

## Goals / Non-Goals

**Goals:**
- Add an `http` command group with `send`, `run`, `list`, and `init` subcommands.
- Support direct HTTP requests without requiring a request file.
- Support executable request definitions stored as `*.http.json` under a nested directory tree.
- Support request-name resolution under the default `./http` root.
- Support environment variable files under `./http/env` plus repeated CLI `--var` overrides.
- Keep example scaffolding clearly separated from executable request definitions.
- Keep the implementation inside the Node runtime and aligned with the current command registration style.

**Non-Goals:**
- YAML request files.
- Batch execution of multiple request files.
- Assertions, pre/post scripts, or workflow orchestration.
- Request inheritance, imports, or shared fragments.
- Multipart upload helpers or advanced auth plugins.
- Python worker support for HTTP requests in v1.

## Decisions

### 1. Implement `http` as a Node runtime command group
The `http` feature should be registered as a new command group and executed entirely in Node.

Rationale:
- HTTP execution does not require Python-specific libraries for the v1 feature set.
- File-system concerns such as directory scanning, JSON parsing, and template substitution are already natural in Node.
- Keeping the feature in Node avoids expanding the Python worker registry and dependency surface.

Alternatives considered:
- **Python runtime command**: rejected because it adds cross-runtime complexity without a clear functional benefit for the initial scope.
- **Hybrid runtime**: rejected because the Node side would still need to own most of the discovery and configuration logic.

### 2. Use four explicit subcommands instead of a single overloaded `http <target>` command
The command group should expose `send`, `run`, `list`, and `init` as separate operations.

Rationale:
- The feature serves both ad hoc and file-driven workflows, and explicit subcommands prevent ambiguity between URLs, logical names, file paths, and scaffolding operations.
- This mirrors the repository’s existing command-group style and keeps help output easier to understand.

Alternatives considered:
- **Single overloaded command**: rejected because target interpretation becomes ambiguous and future growth becomes harder to manage.

### 3. Treat executable and example files as distinct classes
Executable request definitions use `*.http.json`. Example scaffolding uses `*.example.http.json` and `*.example.json`.

Rationale:
- The user explicitly wants `init` output to be instructional only, not runnable.
- Keeping example files non-executable avoids accidental execution of placeholder URLs, tokens, or request bodies.
- `list` output stays focused on actual runnable requests.

Alternatives considered:
- **Allow running example files**: rejected because it weakens the distinction between templates and real configuration.
- **Generate runnable files from `init`**: rejected by product direction for v1.

### 4. Resolve `run` targets in two modes
`run` should accept:
- a logical name such as `user/create`, resolved to `<root>/user/create.http.json`
- a direct file path to any `.http.json` file, even outside the root

Rationale:
- Logical names support the default project-organized workflow under `./http`.
- Direct file paths preserve flexibility for temporary or cross-project request definitions.
- The resolution rules remain predictable because only `*.http.json` qualifies as executable.

Alternatives considered:
- **Restrict all paths to the root**: rejected because it unnecessarily limits valid one-off file-based workflows.

### 5. Use simple `{{name}}` template substitution with CLI override precedence
Request files may contain placeholders in string fields. Variables come from an optional environment file and repeated CLI `--var key=value` flags, with CLI values taking precedence.

Rationale:
- This is enough to support base URLs, tokens, and path/query values in a lightweight way.
- The precedence rule is easy to explain and test.
- It avoids introducing a richer templating engine in v1.

Alternatives considered:
- **Environment file only**: rejected because per-run overrides are important for interface testing.
- **Arbitrary JavaScript templating**: rejected as too powerful and risky for the initial scope.

### 6. Keep request schema intentionally small
The executable request file schema should require `method` and `url`, with optional `name`, `description`, `headers`, `query`, `body`, and `timeout`.

Rationale:
- A constrained schema keeps validation straightforward and matches the intended lightweight scope.
- It gives enough coverage for common GET/POST/PATCH/DELETE testing without prematurely adding workflow features.

Alternatives considered:
- **Richer Postman-like schema**: rejected because it would expand both design and implementation scope significantly.

## Risks / Trade-offs

- **[Risk] Confusion between example files and executable files** → Mitigation: use distinct filename patterns, exclude example files from `run` and `list`, and generate a README example that explains the conversion steps.
- **[Risk] Ambiguity in `run` target resolution** → Mitigation: treat existing `.http.json` file paths as explicit paths, otherwise resolve as logical names under the request root.
- **[Risk] Placeholder substitution may become underpowered for future workflows** → Mitigation: keep substitution deliberately simple in v1 and leave richer composition mechanisms for future changes.
- **[Risk] Response formatting may need to serve both humans and scripts** → Mitigation: provide structured result output and retain a raw JSON mode for machine-friendly consumption.
