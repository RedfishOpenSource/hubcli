from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any

import pymysql
from pymysql.converters import escape_item, encoders
from pymysql.cursors import DictCursor

from hubcli_worker.tasks.mysql.models import MysqlConfig


JS_SAFE_INTEGER_MAX = 9007199254740991
JS_SAFE_INTEGER_MIN = -JS_SAFE_INTEGER_MAX


class MysqlClient:
    def __init__(self, config: MysqlConfig):
        if not config.host:
            raise ValueError("MySQL host is required. Use --host or HUBCLI_MYSQL_HOST.")
        if not config.user:
            raise ValueError("MySQL username is required. Use --user or HUBCLI_MYSQL_USER.")

        self._config = config
        self._connection = pymysql.connect(
            host=config.host,
            port=config.port,
            user=config.user,
            password=config.password,
            database=config.database,
            charset=config.charset,
            connect_timeout=max(1, int(config.timeout)),
            read_timeout=max(1, int(config.timeout)),
            write_timeout=max(1, int(config.timeout)),
            cursorclass=DictCursor,
            autocommit=False,
            **_build_tls_kwargs(config),
        )

    def close(self) -> None:
        self._connection.close()

    def ping(self) -> dict:
        with self._connection.cursor() as cursor:
            cursor.execute("SELECT VERSION() AS version, DATABASE() AS current_database")
            row = cursor.fetchone() or {}
        return {
            "message": "MySQL reachable.",
            "version": row.get("version"),
            "database": row.get("current_database"),
        }

    def select_one(self, sql: str, params: tuple | list | None = None) -> dict | None:
        rows = self.select_all(sql, params=params)
        return rows[0] if rows else None

    def select_all(self, sql: str, params: tuple | list | None = None) -> list[dict]:
        with self._connection.cursor() as cursor:
            cursor.execute(sql, params or ())
            rows = cursor.fetchall() or []
        return [_normalize_row(row) for row in rows]

    def stream_raw_rows(self, sql: str, params: tuple | list | None = None):
        with self._connection.cursor() as cursor:
            cursor.execute(sql, params or ())
            while True:
                row = cursor.fetchone()
                if row is None:
                    break
                yield row

    def escape_literal(self, value) -> str:
        return escape_item(value, self._connection.charset, encoders)

    def execute_script(self, statements: list[str]) -> list[dict]:
        results: list[dict] = []
        with self._connection.cursor() as cursor:
            try:
                for statement in statements:
                    cursor.execute(statement)
                    results.append(
                        {
                            "statement": statement,
                            "rowcount": cursor.rowcount,
                        }
                    )
                self._connection.commit()
            except Exception:
                self._connection.rollback()
                raise
        return results


def _build_tls_kwargs(config: MysqlConfig) -> dict[str, Any]:
    if not any((config.tls.ca_cert, config.tls.client_cert, config.tls.client_key)) and config.tls.verify:
        return {}

    kwargs: dict[str, Any] = {
        "ssl_verify_cert": config.tls.verify,
        "ssl_verify_identity": config.tls.verify,
    }

    if config.tls.ca_cert:
        kwargs["ssl_ca"] = str(config.tls.ca_cert)
    if config.tls.client_cert:
        kwargs["ssl_cert"] = str(config.tls.client_cert)
    if config.tls.client_key:
        kwargs["ssl_key"] = str(config.tls.client_key)

    return kwargs


def _normalize_row(row: dict) -> dict:
    return {key: _normalize_value(value) for key, value in row.items()}


def _normalize_integer(value: int) -> int | str:
    if JS_SAFE_INTEGER_MIN <= value <= JS_SAFE_INTEGER_MAX:
        return value
    return str(value)


def _normalize_value(value):
    if isinstance(value, Decimal):
        return _normalize_integer(int(value)) if value == value.to_integral_value() else float(value)
    if isinstance(value, int) and not isinstance(value, bool):
        return _normalize_integer(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray)):
        return value.decode("utf-8", errors="replace")
    return value
