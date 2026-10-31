"""Structural layer: version gate, Pydantic contract and unsupported-field report."""

from typing import Any

from pydantic import BaseModel, ValidationError

from .. import SUPPORTED_VERSION
from ..contracts.base import Contract
from ..contracts.document import ProjectDocument
from ..contracts.issues import Issue
from .issues import Part, make_issue, path_string

# Pydantic error types mapped to the JSON Schema keyword the browser validator reports.
_CODES = {
    "missing": "schema.required",
    "int_from_float": "schema.type",
    "literal_error": "schema.enum",
    "string_pattern_mismatch": "schema.pattern",
    "string_too_short": "schema.minLength",
    "string_too_long": "schema.maxLength",
    "too_short": "schema.minItems",
    "too_long": "schema.maxItems",
    "greater_than_equal": "schema.minimum",
    "less_than_equal": "schema.maximum",
    "greater_than": "schema.exclusiveMinimum",
    "less_than": "schema.exclusiveMaximum",
    "finite_number": "schema.type",
}

_ADVICE = {
    "schema.required": "Add the missing field.",
    "schema.type": "Use the expected value type.",
    "schema.enum": "Choose one of the allowed values.",
    "schema.pattern": "Use the expected format.",
    "schema.minLength": "Enter a longer value.",
    "schema.maxLength": "Shorten the value.",
    "schema.minItems": "Add more entries.",
    "schema.maxItems": "Remove some entries.",
    "schema.minimum": "Use a larger number.",
    "schema.maximum": "Use a smaller number.",
    "schema.exclusiveMinimum": "Use a larger number.",
    "schema.exclusiveMaximum": "Use a smaller number.",
}


def _code(error_type: str) -> str:
    if error_type in _CODES:
        return _CODES[error_type]
    if error_type.endswith("_type") or error_type == "model_attributes_type":
        return "schema.type"
    return "schema.invalid"


def version_gate(raw: Any) -> list[Issue]:
    """Reject non-documents, missing/old/future versions before the structural contract runs."""
    if not isinstance(raw, dict):
        return [make_issue(raw, "error", "document.type", [], "The file is not a capability project document. Import a YAML mapping with version, project, settings and capabilities.")]
    if "version" not in raw:
        return [make_issue(raw, "error", "version.missing", ["version"], "The document has no version. Add `version: 2`, or import it as a version 1 document to migrate it.")]
    version = raw["version"]
    if type(version) is int and version == SUPPORTED_VERSION:
        return []
    if type(version) is int and version == 1:
        return [make_issue(raw, "error", "version.migrationRequired", ["version"], "This is a version 1 document. Migrate it to version 2 (the original is kept) before editing.")]
    if type(version) is int and version > SUPPORTED_VERSION:
        return [make_issue(raw, "error", "version.unsupported", ["version"], f"This document uses version {version}, created by a newer release. This app supports version {SUPPORTED_VERSION}; update the app to open it.")]
    return [make_issue(raw, "error", "version.unsupported", ["version"], f"Unsupported document version {version!r}. This app supports version {SUPPORTED_VERSION}.")]


def structural(raw: dict[str, Any]) -> tuple[ProjectDocument | None, list[Issue]]:
    try:
        return ProjectDocument.model_validate(raw), []
    except ValidationError as exc:
        issues = []
        for error in exc.errors(include_url=False):
            parts: list[Part] = list(error["loc"])
            code = _code(error["type"])
            field = next((str(part) for part in reversed(parts) if isinstance(part, str)), "document")
            if code == "schema.pattern" and error.get("ctx", {}).get("pattern") == r"\S":
                message = f"{field}: cannot be blank; enter a value."
            else:
                message = f"{field}: {error['msg']} (at {path_string(parts) or 'document'}). {_ADVICE.get(code, 'Correct the value.')}"
            issues.append(make_issue(raw, "error", code, parts, message))
        return None, issues


def unsupported_fields(model: BaseModel, raw: Any, parts: list[Part] | None = None) -> list[Issue]:
    """Report (never drop) fields the contract does not define. ``extensions`` objects are free-form."""
    parts = parts or []
    issues = []
    for key in model.model_extra or {}:
        issues.append(make_issue(raw, "warning", "field.unsupported", [*parts, key],
                                 f"`{path_string([*parts, key])}` is not part of the version 2 format. It is kept as-is; move custom data under `extensions` to silence this warning."))
    for name, field in type(model).model_fields.items():
        value = getattr(model, name)
        key = field.alias or name
        if isinstance(value, Contract):
            issues.extend(unsupported_fields(value, raw, [*parts, key]))
        elif isinstance(value, list):
            for index, item in enumerate(value):
                if isinstance(item, Contract):
                    issues.extend(unsupported_fields(item, raw, [*parts, key, index]))
    return issues
