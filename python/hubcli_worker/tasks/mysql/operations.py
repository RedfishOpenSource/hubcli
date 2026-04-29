from __future__ import annotations

import re

import sqlparse

from hubcli_worker.tasks.mysql.client import MysqlClient
from hubcli_worker.tasks.mysql.config import build_mysql_config
from hubcli_worker.tasks.mysql.exporters import append_sql_lines, export_rows, export_sql

READ_ONLY_PREFIXES = {"SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH"}
WRITE_PREFIXES = {
    "INSERT",
    "UPDATE",
    "DELETE",
    "REPLACE",
    "CREATE",
    "ALTER",
    "DROP",
    "TRUNCATE",
    "RENAME",
    "GRANT",
    "REVOKE",
    "SET",
    "USE",
}
SYSTEM_DATABASES = {"information_schema", "mysql", "performance_schema", "sys"}
IDENTIFIER_PATTERN = re.compile(r"^[0-9A-Za-z$_]+$")


def _require_sql(options: dict) -> str:
    sql = (options.get("sql") or "").strip()
    if not sql:
        raise ValueError("SQL text is required. Use --sql or --file.")
    return sql


def _split_statements(sql: str, allow_multi: bool) -> list[str]:
    statements = [item.strip() for item in sqlparse.split(sql) if item.strip()]
    if not statements:
        raise ValueError("No executable SQL statements found.")
    if len(statements) > 1 and not allow_multi:
        raise ValueError("Multiple SQL statements require --multi.")
    return statements


def _first_keyword(statement: str) -> str:
    parsed = sqlparse.parse(statement)
    if not parsed:
        return ""

    fallback = ""
    for token in parsed[0].flatten():
        if token.is_whitespace or token.ttype in sqlparse.tokens.Comment:
            continue
        normalized = token.normalized.upper()
        if not fallback and token.ttype in sqlparse.tokens.Keyword:
            fallback = normalized
        if token.ttype in sqlparse.tokens.Keyword.DML or token.ttype in sqlparse.tokens.Keyword.DDL:
            return normalized
    return fallback


def _ensure_read_only(statements: list[str]) -> None:
    for statement in statements:
        keyword = _first_keyword(statement)
        if keyword not in READ_ONLY_PREFIXES:
            raise ValueError(f"Read-only command rejected SQL starting with: {keyword or 'UNKNOWN'}")


def _ensure_write_allowed(statements: list[str], options: dict) -> None:
    if not options.get("allowWrite") or not options.get("yes"):
        raise ValueError("Mutating SQL requires both --allow-write and --yes.")
    for statement in statements:
        keyword = _first_keyword(statement)
        if keyword not in WRITE_PREFIXES:
            raise ValueError(f"Write command rejected SQL starting with: {keyword or 'UNKNOWN'}")


def _apply_limit(sql: str, limit: int | None) -> str:
    if not limit:
        return sql
    if _first_keyword(sql) not in {"SELECT", "WITH"}:
        return sql
    if re.search(r"\blimit\b", sql, flags=re.IGNORECASE):
        return sql
    return f"{sql.rstrip().rstrip(';')} LIMIT {int(limit)}"


def _escape_identifier(identifier: str) -> str:
    if not IDENTIFIER_PATTERN.fullmatch(identifier):
        raise ValueError(f"Unsafe identifier: {identifier}")
    return f"`{identifier}`"


def _database_list(client: MysqlClient) -> list[dict]:
    rows = client.select_all(
        """
        SELECT schema_name AS database_name
        FROM information_schema.schemata
        ORDER BY schema_name
        """
    )
    table_counts = client.select_all(
        """
        SELECT table_schema AS database_name, COUNT(*) AS table_count
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
        GROUP BY table_schema
        ORDER BY table_schema
        """
    )
    counts_by_name = {row["database_name"]: row["table_count"] for row in table_counts}

    result = []
    for row in rows:
        name = row["database_name"]
        result.append(
            {
                "database": name,
                "tableCount": counts_by_name.get(name, 0),
                "system": name in SYSTEM_DATABASES,
            }
        )
    return result


def _table_list(client: MysqlClient, options: dict) -> list[dict]:
    database = options.get("database")
    if not database:
        raise ValueError("Database name is required. Use --database.")

    return client.select_all(
        """
        SELECT table_name AS tableName, table_type AS tableType, engine, table_rows AS estimatedRows
        FROM information_schema.tables
        WHERE table_schema = %s
        ORDER BY table_name
        """,
        (database,),
    )


def _run_read_query(client: MysqlClient, options: dict) -> object:
    sql = _require_sql(options)
    statements = _split_statements(sql, bool(options.get("multi")))
    _ensure_read_only(statements)

    if len(statements) == 1:
        return client.select_all(_apply_limit(statements[0], options.get("limit")))

    return [
        {
            "statement": statement,
            "rows": client.select_all(_apply_limit(statement, options.get("limit"))),
        }
        for statement in statements
    ]


def _run_write_query(client: MysqlClient, options: dict) -> object:
    sql = _require_sql(options)
    statements = _split_statements(sql, bool(options.get("multi")))
    _ensure_write_allowed(statements, options)
    return {
        "message": "SQL executed.",
        "results": client.execute_script(statements),
    }


def _export_query(client: MysqlClient, options: dict) -> object:
    output = options.get("output")
    if not output:
        raise ValueError("Output path is required. Use --output.")

    format_name = (options.get("format") or "json").lower()
    if format_name not in {"csv", "json", "tsv"}:
        raise ValueError("Query export format must be csv, json, or tsv.")

    result = _run_read_query(client, options)
    if not isinstance(result, list):
        raise ValueError("Query export requires a single result set.")
    if options.get("multi") or any(isinstance(item, dict) and "rows" in item for item in result):
        raise ValueError("Query export does not support multiple result sets. Remove --multi.")
    return export_rows(result, output, format_name)


def _dump_database(client: MysqlClient, options: dict) -> object:
    output = options.get("output")
    if not output:
        raise ValueError("Output path is required. Use --output.")

    format_name = (options.get("format") or "sql").lower()
    if format_name != "sql":
        raise ValueError("Dump export format must be sql.")

    database = options.get("database")
    if not database:
        raise ValueError("Database name is required. Use --database.")

    schema_only = bool(options.get("schemaOnly"))
    data_only = bool(options.get("dataOnly"))
    if schema_only and data_only:
        raise ValueError("Use either --schema-only or --data-only, not both.")

    tables = options.get("tables") or [row["tableName"] for row in _table_list(client, options)]
    if not tables:
        return export_sql("", output)

    append_sql_lines(
        [f"CREATE DATABASE IF NOT EXISTS {_escape_identifier(database)};", f"USE {_escape_identifier(database)};", ""],
        output,
        mode="w",
    )

    for table in tables:
        table_name = _escape_identifier(table)
        if not data_only:
            create_row = client.select_one(f"SHOW CREATE TABLE {table_name}")
            if not create_row:
                raise ValueError(f"Failed to read table definition for {table}.")
            create_table_sql = create_row.get("Create Table")
            create_view_sql = create_row.get("Create View")
            if create_table_sql:
                append_sql_lines([f"DROP TABLE IF EXISTS {table_name};", f"{create_table_sql};", ""], output)
            elif create_view_sql:
                append_sql_lines([f"DROP VIEW IF EXISTS {table_name};", f"{create_view_sql};", ""], output)
            else:
                raise ValueError(f"Unsupported SHOW CREATE output for {table}.")

        if schema_only:
            continue

        columns = [row.get("Field") for row in client.select_all(f"SHOW COLUMNS FROM {table_name}")]
        if not columns:
            continue
        column_list = ", ".join(_escape_identifier(column) for column in columns if column)
        wrote_rows = False
        for row in client.stream_raw_rows(f"SELECT * FROM {table_name}"):
            values = ", ".join(client.escape_literal(row.get(column)) for column in columns)
            append_sql_lines([f"INSERT INTO {table_name} ({column_list}) VALUES ({values});"], output)
            wrote_rows = True
        if wrote_rows:
            append_sql_lines([""], output)

    return {"message": f"Written to {output}"}


def _run_operation(client: MysqlClient, operation: str, options: dict) -> object:
    if operation == "ping":
        return client.ping()
    if operation == "database.list":
        return _database_list(client)
    if operation == "table.list":
        return _table_list(client, options)
    if operation == "query.run":
        return _run_read_query(client, options)
    if operation == "query.cross":
        return _run_read_query(client, options)
    if operation == "exec.run":
        return _run_write_query(client, options)
    if operation == "export.query":
        return _export_query(client, options)
    if operation == "export.dump":
        return _dump_database(client, options)
    raise ValueError(f"Unsupported MySQL operation: {operation}")


def run_operation(operation: str, options: dict) -> object:
    client = MysqlClient(build_mysql_config(options))
    try:
        return _run_operation(client, operation, options)
    finally:
        client.close()
