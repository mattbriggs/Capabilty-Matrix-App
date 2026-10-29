"""Transport and issue contracts."""

import json

import pytest
from pydantic import ValidationError

from capmatrix.contracts.issues import Issue, ValidationReport
from capmatrix.contracts.messages import MigrateRequest, SchemaRequest, SidecarResponse, ValidateRequest, request_adapter


def issue(**overrides):
    return Issue(**{"severity": "error", "code": "x", "entityType": "capability", "entityId": "a", "path": "capabilities.0", "message": "m"} | overrides)


def test_requests_discriminate_on_operation():
    assert isinstance(request_adapter.validate_python({"operation": "validate", "document": {}}), ValidateRequest)
    assert isinstance(request_adapter.validate_python({"operation": "schema"}), SchemaRequest)
    migrate = request_adapter.validate_python({"operation": "migrate", "document": [], "options": {"projectId": "p1", "now": "2026-10-29T00:00:00Z"}})
    assert isinstance(migrate, MigrateRequest) and migrate.options.name is None


@pytest.mark.parametrize("payload", [
    {"operation": "publish", "document": {}},
    {"operation": "migrate", "document": {}},
    {"operation": "migrate", "document": {}, "options": {"projectId": "../x", "now": "2026-10-29T00:00:00Z"}},
    {"operation": "migrate", "document": {}, "options": {"projectId": "p", "now": "yesterday"}},
    {"operation": "validate", "document": {}, "extra": 1},
    {"operation": "schema", "document": {}},
    {"document": {}},
])
def test_invalid_envelopes_are_rejected(payload):
    with pytest.raises(ValidationError):
        request_adapter.validate_python(payload)


def test_validate_request_accepts_any_document_shape():
    for document in ({}, [], "text", None, 5):
        assert request_adapter.validate_python({"operation": "validate", "document": document}).document == document


def test_response_serializes_schema_alias_and_omits_none():
    text = SidecarResponse(ok=True, **{"schema": {"type": "object"}}).to_json()
    assert json.loads(text) == {"ok": True, "issues": [], "schema": {"type": "object"}}


def test_response_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        SidecarResponse(ok=True, surprise=1)


def test_issue_is_frozen_strict_and_complete():
    item = issue()
    with pytest.raises(ValidationError):
        item.code = "y"
    with pytest.raises(ValidationError):
        issue(severity="fatal")
    with pytest.raises(ValidationError):
        issue(entityType="widget")
    with pytest.raises(ValidationError):
        Issue(severity="error", code="x", entityType="capability", path="", message="m")  # entityId is required (may be null)
    assert item.key() == ("capabilities.0", "x", "error", "capability", "a")
    assert issue(entityId=None).key()[-1] == ""


def test_report_ok_is_computed_from_severity():
    assert ValidationReport(issues=[issue(severity="warning")]).ok
    report = ValidationReport(issues=[issue(), issue(severity="warning")])
    assert not report.ok and len(report.errors()) == 1
    assert json.loads(report.model_dump_json())["ok"] is False
