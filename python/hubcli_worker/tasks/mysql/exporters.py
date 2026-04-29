from __future__ import annotations

import csv
import json
from pathlib import Path


def _ensure_parent(path: str) -> Path:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    return output_path


def export_rows(rows: list[dict], output: str, format_name: str) -> dict:
    output_path = _ensure_parent(output)
    if format_name == "json":
        output_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
        return {"message": f"Written to {output_path}"}

    delimiter = "\t" if format_name == "tsv" else ","
    fieldnames = list(rows[0].keys()) if rows else []
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, delimiter=delimiter)
        writer.writeheader()
        writer.writerows(rows)
    return {"message": f"Written to {output_path}"}


def export_sql(text: str, output: str) -> dict:
    output_path = _ensure_parent(output)
    output_path.write_text(text, encoding="utf-8")
    return {"message": f"Written to {output_path}"}


def append_sql_lines(lines: list[str], output: str, *, mode: str = "a") -> dict:
    output_path = _ensure_parent(output)
    with output_path.open(mode, encoding="utf-8", newline="") as handle:
        for line in lines:
            handle.write(line)
            if not line.endswith("\n"):
                handle.write("\n")
    return {"message": f"Written to {output_path}"}
