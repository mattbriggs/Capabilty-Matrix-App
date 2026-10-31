"""Application layer: dispatch a validated request envelope to its operation."""

from typing import Any

from pydantic import ValidationError

from .contracts.messages import (
    ManifestRequest,
    MigrateRequest,
    SchemaRequest,
    SidecarResponse,
    SummaryRequest,
    ValidateRequest,
    request_adapter,
)
from .migration import MigrationError, migrate_v1
from .reports import content_manifest, report_summary
from .schema_export import project_schema
from .validation.pipeline import normalize_document, validate_document


def handle(payload: Any) -> SidecarResponse:
    try:
        request = request_adapter.validate_python(payload)
    except ValidationError as exc:
        first = exc.errors(include_url=False)[0]
        where = ".".join(str(part) for part in first["loc"]) or "request"
        return SidecarResponse(ok=False, error=f"Invalid sidecar request at {where}: {first['msg']}")

    if isinstance(request, SchemaRequest):
        return SidecarResponse(ok=True, **{"schema": project_schema()})

    if isinstance(request, MigrateRequest):
        try:
            document, notes = migrate_v1(request.document, request.options.projectId, request.options.now, request.options.name)
        except MigrationError as exc:
            return SidecarResponse(ok=False, error=str(exc))
        report = validate_document(document)
        return SidecarResponse(ok=report.ok, issues=report.issues, document=document, notes=notes)

    report = validate_document(request.document)
    if isinstance(request, ValidateRequest) or not report.ok:
        return SidecarResponse(ok=report.ok, issues=report.issues)
    document = normalize_document(request.document)
    if isinstance(request, ManifestRequest):
        return SidecarResponse(ok=True, issues=report.issues, manifest=content_manifest(document))
    assert isinstance(request, SummaryRequest)
    return SidecarResponse(ok=True, issues=report.issues, summary=report_summary(document))
