"""Helpers that turn a path into an attributed ``Issue``. Mirrors ``src/domain/issues.js``."""

from typing import Any, Sequence

from ..contracts.issues import Issue

Part = str | int


def path_string(parts: Sequence[Part]) -> str:
    return ".".join(str(part) for part in parts)


def _at(value: Any, *keys: Part) -> Any:
    for key in keys:
        if isinstance(key, int):
            if not isinstance(value, list) or key >= len(value):
                return None
            value = value[key]
        else:
            if not isinstance(value, dict):
                return None
            value = value.get(key)
    return value


def _text(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def entity_for(doc: Any, parts: Sequence[Part]) -> tuple[str, str | None]:
    """Attribute a path to the record a user would open to fix it."""
    if not parts:
        return "document", None
    head = parts[0]
    index = parts[1] if len(parts) > 1 and isinstance(parts[1], int) else None
    if head == "project":
        return "project", _text(_at(doc, "project", "id"))
    if head == "settings":
        if len(parts) > 2 and parts[1] == "audiences" and isinstance(parts[2], int):
            return "audience", _text(_at(doc, "settings", "audiences", parts[2], "id"))
        if len(parts) > 1 and parts[1] == "timeline":
            return "timeline", None
        return "settings", None
    if head == "capabilities" and index is not None:
        cap_id = _text(_at(doc, "capabilities", index, "id"))
        if len(parts) > 3 and parts[2] == "levels" and isinstance(parts[3], int):
            level_id = _text(_at(doc, "capabilities", index, "levels", parts[3], "id"))
            return "level", f"{cap_id}/{level_id}" if cap_id and level_id else None
        return "capability", cap_id
    if head == "domains" and index is not None:
        return "domain", _text(_at(doc, "domains", index, "id"))
    if head == "timeSegments" and index is not None:
        return "timeSegment", _text(_at(doc, "timeSegments", index, "date"))
    if head == "mapViews" and index is not None:
        return "mapView", _text(_at(doc, "mapViews", index, "id"))
    if head == "presentation":
        return "presentation", None
    return "document", None


def make_issue(doc: Any, severity: str, code: str, parts: Sequence[Part], message: str) -> Issue:
    entity_type, entity_id = entity_for(doc, parts)
    return Issue(
        severity=severity, code=code, entityType=entity_type, entityId=entity_id,
        path=path_string(parts), message=message,
    )


def sort_issues(issues: list[Issue]) -> list[Issue]:
    return sorted(issues, key=lambda issue: issue.key())
