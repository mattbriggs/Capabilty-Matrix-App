"""Compose the validation layers into one report."""

from typing import Any

from ..contracts.document import ProjectDocument
from ..contracts.issues import ValidationReport
from .issues import sort_issues
from .semantic import semantic
from .structural import structural, unsupported_fields, version_gate


def validate_document(raw: Any) -> ValidationReport:
    """Validate raw input before any normalization. Later layers run only when earlier ones pass."""
    gate = version_gate(raw)
    if gate:
        return ValidationReport(issues=gate)
    model, issues = structural(raw)
    if model is None:
        return ValidationReport(issues=sort_issues(issues))
    normalized = model.model_dump(mode="json", by_alias=True)
    issues = unsupported_fields(model, raw) + semantic(normalized)
    return ValidationReport(issues=sort_issues(issues))


def normalize_document(raw: Any) -> dict[str, Any]:
    """Defaults-filled document for a structurally valid input (raises ``ValidationError`` otherwise)."""
    return ProjectDocument.model_validate(raw).model_dump(mode="json", by_alias=True)
