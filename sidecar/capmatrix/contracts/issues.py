"""Structured validation issues shared by the browser validator and the sidecar."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, computed_field

Severity = Literal["error", "warning", "info"]
EntityType = Literal[
    "document", "project", "settings", "timeline", "audience", "capability", "level",
    "domain", "timeSegment", "presentation", "mapView",
]


class Issue(BaseModel):
    """``{severity, code, entityType, entityId, path, message}``; ``path`` is dotted, e.g. ``capabilities.0.target``."""

    model_config = ConfigDict(strict=True, extra="forbid", frozen=True)

    severity: Severity
    code: str
    entityType: EntityType
    entityId: str | None
    path: str
    message: str

    def key(self) -> tuple[str, str, str, str, str]:
        """Comparison key used for browser/Python parity (messages may differ in wording)."""
        return (self.path, self.code, self.severity, self.entityType, self.entityId or "")


class ValidationReport(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")

    issues: list[Issue]

    @computed_field
    @property
    def ok(self) -> bool:
        return not any(issue.severity == "error" for issue in self.issues)

    def errors(self) -> list[Issue]:
        return [issue for issue in self.issues if issue.severity == "error"]
