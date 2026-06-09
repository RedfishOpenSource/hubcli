## ADDED Requirements

### Requirement: Direct HTTP request execution
The system SHALL support sending direct HTTP requests without reading a request definition file.

#### Scenario: Default GET request
- **WHEN** the user runs `hubcli http send https://example.com`
- **THEN** the system sends an HTTP GET request to `https://example.com`

#### Scenario: Explicit method and JSON body
- **WHEN** the user runs `hubcli http send https://example.com/users --method POST --json-body '{"name":"demo"}'`
- **THEN** the system sends an HTTP POST request to that URL with the provided JSON body

### Requirement: File-based request execution
The system SHALL support executing a request from an executable JSON request definition file.

#### Scenario: Run by logical name
- **WHEN** the user runs `hubcli http run user/create`
- **THEN** the system resolves `./http/user/create.http.json`
- **THEN** the system executes that request definition

#### Scenario: Run by explicit file path
- **WHEN** the user runs `hubcli http run D:/temp/demo.http.json`
- **THEN** the system treats the value as an explicit executable request file path
- **THEN** the system executes that request definition without requiring it to be under `./http`

### Requirement: Nested request directory support
The system SHALL support nested directories for organizing executable request definitions.

#### Scenario: Resolve nested logical request name
- **WHEN** the user runs `hubcli http run folder1/folder2/folder3/xxx`
- **THEN** the system resolves `./http/folder1/folder2/folder3/xxx.http.json`
- **THEN** the system executes that request definition

### Requirement: Example files are non-executable
The system SHALL treat example request definitions as scaffolding only and MUST NOT execute them.

#### Scenario: Example file is excluded from logical execution
- **WHEN** the user runs `hubcli http run user/create.example`
- **THEN** the system does not resolve `./http/user/create.example.http.json` as an executable request definition
- **THEN** the command fails with a message indicating that example files are not runnable request definitions

#### Scenario: Example file path is rejected
- **WHEN** the user runs `hubcli http run ./http/user/create.example.http.json`
- **THEN** the system rejects the file as a non-executable example request definition

### Requirement: Executable request listing
The system SHALL list only executable request definitions and MUST exclude example files from listing output.

#### Scenario: List executable requests from default root
- **WHEN** the user runs `hubcli http list`
- **THEN** the system lists logical names derived from `*.http.json` files under `./http`
- **THEN** the system excludes any `*.example.http.json` files from the output

#### Scenario: List executable requests from a nested path
- **WHEN** the user runs `hubcli http list folder1/folder2`
- **THEN** the system lists executable request definitions under that nested path only

### Requirement: Environment and CLI variable substitution
The system SHALL support replacing `{{name}}` placeholders using environment JSON files and CLI-provided variables.

#### Scenario: Load variables from environment file
- **WHEN** the user runs `hubcli http run user/detail --env dev`
- **THEN** the system loads variables from `./http/env/dev.json`
- **THEN** the system substitutes matching `{{name}}` placeholders before executing the request

#### Scenario: CLI variables override environment variables
- **WHEN** the user runs `hubcli http run user/detail --env dev --var userId=1002`
- **THEN** the system uses values from `./http/env/dev.json`
- **THEN** the system overrides matching variables with CLI-provided values before executing the request

### Requirement: Example workspace initialization
The system SHALL initialize an HTTP request workspace containing example-only files.

#### Scenario: Initialize default workspace
- **WHEN** the user runs `hubcli http init`
- **THEN** the system creates the `./http` directory if needed
- **THEN** the system creates example request files, example environment files, and example usage guidance

#### Scenario: Initialized files are examples only
- **WHEN** the user runs `hubcli http init ./apis`
- **THEN** the system creates request templates using the `*.example.http.json` naming pattern
- **THEN** the system creates environment templates using the `*.example.json` naming pattern
- **THEN** the system does not create runnable `*.http.json` request files as part of initialization
