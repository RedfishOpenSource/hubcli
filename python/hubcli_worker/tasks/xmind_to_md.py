from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from xml.etree import ElementTree
from zipfile import ZipFile


def _extract_title(topic: dict[str, Any]) -> str:
    title = topic.get("title") or topic.get("topic") or "Untitled Topic"
    return str(title).strip() or "Untitled Topic"


def _extract_note(topic: dict[str, Any]) -> str | None:
    note = topic.get("note") or topic.get("notes")
    if isinstance(note, dict):
        plain = note.get("plain")
        if isinstance(plain, dict):
            content = plain.get("content") or plain.get("text")
            if content:
                return str(content).strip()
        content = note.get("content") or note.get("text")
        if content:
            return str(content).strip()
    if isinstance(note, str):
        return note.strip() or None
    return None


def _iter_children(topic: dict[str, Any]) -> list[dict[str, Any]]:
    children = topic.get("topics") or topic.get("children") or []
    if isinstance(children, dict):
        attached = children.get("attached") or []
        detached = children.get("detached") or []
        children = [*attached, *detached]
    return [child for child in children if isinstance(child, dict)]


def _append_topic(lines: list[str], topic: dict[str, Any], depth: int) -> None:
    indent = "  " * max(depth - 1, 0)
    lines.append(f"{indent}- {_extract_title(topic)}")

    note = _extract_note(topic)
    if note:
        for note_line in note.splitlines():
            lines.append(f"{indent}  > {note_line}")

    for child in _iter_children(topic):
        _append_topic(lines, child, depth + 1)


def _normalize_json_topic(topic: dict[str, Any]) -> dict[str, Any]:
    children = topic.get("children") or {}
    normalized_children: dict[str, list[dict[str, Any]]] = {}
    if isinstance(children, dict):
        normalized_children = {
            "attached": [_normalize_json_topic(child) for child in children.get("attached") or [] if isinstance(child, dict)],
            "detached": [_normalize_json_topic(child) for child in children.get("detached") or [] if isinstance(child, dict)],
        }

    return {
        "title": topic.get("title") or topic.get("topic") or "Untitled Topic",
        "notes": topic.get("notes") or topic.get("note"),
        "children": normalized_children,
    }


def _normalize_json_sheet(sheet: dict[str, Any]) -> dict[str, Any]:
    return {
        "title": sheet.get("title") or "Untitled Sheet",
        "topic": _normalize_json_topic(sheet.get("rootTopic") or sheet.get("topic") or {}),
        "relationships": sheet.get("relationships") or [],
    }


def _read_xml_note(topic_element: ElementTree.Element) -> str | None:
    note_text = topic_element.findtext("./notes/plain")
    if note_text:
        return note_text.strip() or None
    return None


def _normalize_xml_topic(topic_element: ElementTree.Element) -> dict[str, Any]:
    child_topics = []
    for child in topic_element.findall("./children/topics/topic"):
        child_topics.append(_normalize_xml_topic(child))

    return {
        "title": topic_element.findtext("title") or "Untitled Topic",
        "note": _read_xml_note(topic_element),
        "children": {
            "attached": child_topics,
            "detached": [],
        },
    }


def _load_xmind_sheets(input_path: Path) -> list[dict[str, Any]]:
    with ZipFile(input_path) as archive:
        names = set(archive.namelist())
        if "content.json" in names:
            data = json.loads(archive.read("content.json").decode("utf-8"))
            if not isinstance(data, list):
                raise ValueError("Unsupported XMind content.json structure.")
            return [_normalize_json_sheet(sheet) for sheet in data if isinstance(sheet, dict)]

        if "content.xml" in names:
            root = ElementTree.fromstring(archive.read("content.xml"))
            sheets: list[dict[str, Any]] = []
            for sheet_element in root.findall("sheet"):
                topic_element = sheet_element.find("topic")
                sheets.append(
                    {
                        "title": sheet_element.findtext("title") or "Untitled Sheet",
                        "topic": _normalize_xml_topic(topic_element) if topic_element is not None else {},
                        "relationships": [],
                    }
                )
            return sheets

    raise ValueError("Unsupported XMind file: missing content.json or content.xml.")


def _sheet_to_markdown(sheet: dict[str, Any]) -> tuple[str, list[str]]:
    sheet_title = str(sheet.get("title") or "Untitled Sheet").strip() or "Untitled Sheet"
    root_topic = sheet.get("topic") or {}
    lines: list[str] = [f"# {sheet_title}", "", f"## {_extract_title(root_topic)}"]

    root_note = _extract_note(root_topic)
    if root_note:
        lines.extend(["", *[f"> {line}" for line in root_note.splitlines()]])

    children = _iter_children(root_topic)
    if children:
        lines.append("")
        for child in children:
            _append_topic(lines, child, 1)

    warnings: list[str] = []
    if sheet.get("relationships"):
        warnings.append(f"Sheet '{sheet_title}' contains relationships that were not exported.")
    return "\n".join(lines).strip(), warnings


def convert_xmind_to_markdown(input_path: Path, output_path: Path) -> dict:
    if input_path.suffix.lower() != ".xmind":
        raise ValueError(f"Expected a .xmind file: {input_path}")

    sheets = _load_xmind_sheets(input_path)
    if not sheets:
        raise ValueError("The XMind file did not contain any sheets.")

    document_parts: list[str] = []
    warnings: list[str] = []

    for sheet in sheets:
        markdown, sheet_warnings = _sheet_to_markdown(sheet)
        document_parts.append(markdown)
        warnings.extend(sheet_warnings)

    output_path.write_text("\n\n".join(document_parts).strip() + "\n", encoding="utf-8")
    return {
        "outputPath": str(output_path),
        "warnings": warnings,
    }
