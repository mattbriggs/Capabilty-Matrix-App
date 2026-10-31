"""Application (service) and transport layers, including the real sidecar entry point."""

import copy
import io
import json
import subprocess
import sys

from capmatrix.service import handle
from capmatrix.transport import serve_once
from conftest import ROOT, load_json


def test_validate_returns_structured_issues(base_document):
    doc = copy.deepcopy(base_document)
    doc["capabilities"][0]["target"] = 9
    response = handle({"operation": "validate", "document": doc})
    assert not response.ok
    assert [(i.path, i.code) for i in response.issues] == [("capabilities.0.target", "maturity.range")]


def test_manifest_and_summary_require_a_valid_document(base_document):
    manifest = handle({"operation": "content-manifest", "document": base_document})
    assert manifest.ok and manifest.manifest[0]["status"] == "draft-mapping"
    assert manifest.manifest[0]["deliveryTargets"] == ["embedded-help", "pdf-manual"]
    summary = handle({"operation": "report-summary", "document": base_document})
    assert summary.summary == {"projectId": "prj-fixture", "capabilityCount": 3, "domainCount": 1, "handoffs": ["alpha"], "unassignedDomain": ["beta", "gamma"]}
    broken = handle({"operation": "report-summary", "document": {"version": 2}})
    assert not broken.ok and broken.summary is None and broken.issues


def test_migrate_returns_the_document_notes_and_its_issues():
    v1 = {"version": 1, "capabilities": [{"id": "a", "name": "A", "current": 0, "target": 1, "owner": "typo"}]}
    response = handle({"operation": "migrate", "document": v1, "options": {"projectId": "prj-1", "now": "2026-10-29T00:00:00Z"}})
    assert response.document["version"] == 2 and response.notes
    assert not response.ok and response.issues[0].path == "capabilities.0.owner"
    refused = handle({"operation": "migrate", "document": {"version": 2}, "options": {"projectId": "prj-1", "now": "2026-10-29T00:00:00Z"}})
    assert not refused.ok and "version 1" in refused.error


def test_schema_operation_returns_the_committed_schema():
    response = handle({"operation": "schema"})
    assert response.schema_ == json.loads((ROOT / "src" / "data" / "schema" / "capability-project.schema.json").read_text())


def test_invalid_envelope_is_an_error_not_a_crash():
    response = handle({"operation": "publish"})
    assert not response.ok and response.error.startswith("Invalid sidecar request")


def test_serve_once_round_trip(base_document):
    out = io.StringIO()
    serve_once(io.StringIO(json.dumps({"operation": "validate", "document": base_document}) + "\n"), out)
    assert json.loads(out.getvalue()) == {"ok": True, "issues": []}
    out = io.StringIO()
    serve_once(io.StringIO("{not json\n"), out)
    assert json.loads(out.getvalue())["error"].startswith("Request is not valid JSON")
    out = io.StringIO()
    serve_once(io.StringIO(""), out)
    assert out.getvalue() == ""


def test_deeply_nested_input_is_reported():
    out = io.StringIO()
    nested = "[" * 5000 + "]" * 5000
    serve_once(io.StringIO('{"operation":"validate","document":' + nested + "}\n"), out)
    response = json.loads(out.getvalue())
    assert response["ok"] is False


def test_sidecar_entry_point_end_to_end():
    cases = load_json("validation/cases.json")
    payload = json.dumps({"operation": "validate", "document": cases["base"]})
    result = subprocess.run([sys.executable, str(ROOT / "sidecar" / "main.py")], input=payload + "\n", capture_output=True, text=True, timeout=60, check=True)
    assert json.loads(result.stdout) == {"ok": True, "issues": []}
