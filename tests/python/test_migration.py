"""Explicit version 1 → 2 migration (twin: src/domain/migrate.js)."""

import copy
from pathlib import Path

import pytest
import yaml

from capmatrix.migration import MigrationError, is_version_1, migrate_v1, slug
from capmatrix.validation import validate_document
from conftest import FIXTURES, load_json


class StringDateLoader(yaml.SafeLoader):
    """YAML 1.2 semantics for dates: keep 2026-10-01 a string, as the browser parser does."""


StringDateLoader.yaml_implicit_resolvers = {
    key: [(tag, regex) for tag, regex in value if tag != "tag:yaml.org,2002:timestamp"]
    for key, value in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


def v1_sample():
    return yaml.load((FIXTURES / "migration" / "v1-sample.yaml").read_text(), Loader=StringDateLoader)


def test_sample_migration_matches_the_shared_golden():
    expected = load_json("migration/v1-sample.expected.json")
    options = expected["options"]
    document, notes = migrate_v1(v1_sample(), options["projectId"], options["now"], options["name"])
    assert document == expected["document"]
    assert notes == expected["notes"]


def test_migrated_sample_is_valid_and_keeps_details():
    document, _ = migrate_v1(v1_sample(), "prj-x", "2026-10-29T00:00:00Z")
    assert validate_document(document).ok
    guidance = document["capabilities"][0]
    assert guidance["audienceIds"] == ["client", "consultant"]
    assert guidance["dita"]["audience"] == ["client", "consultant"]  # DITA mapping kept separate
    assert [level["id"] for level in guidance["levels"]][:3] == ["emerging", "initial", "defined"]
    assert guidance["levels"][0]["description"] == "Ad hoc content with no shared approach."
    assert document["settings"]["timeline"]["asOf"] == "2026-10-01"
    assert document["domains"] == [] and document["mapViews"] == []


def test_migration_does_not_mutate_its_input():
    source = v1_sample()
    snapshot = copy.deepcopy(source)
    migrate_v1(source, "prj-x", "2026-10-29T00:00:00Z")
    assert source == snapshot


def test_invalid_values_are_carried_over_and_reported():
    source = v1_sample()
    source["capabilities"][0]["owner"] = "typo"
    source["capabilities"][1]["current"] = 1.5
    source["capabilities"][2]["dependencies"] = ["missing"]
    document, _ = migrate_v1(source, "prj-x", "2026-10-29T00:00:00Z")
    assert document["capabilities"][0]["owner"] == "typo"
    assert document["capabilities"][1]["current"] == 1.5
    report = validate_document(document)
    assert not report.ok
    assert {i.path for i in report.issues} >= {"capabilities.0.owner", "capabilities.1.current"}


def test_version_1_defaults_are_applied_only_where_missing():
    document, notes = migrate_v1({"version": 1, "capabilities": [{"id": "a", "name": "A", "current": 0, "target": 1}]}, "prj-x", "2026-10-29T00:00:00Z")
    cap = document["capabilities"][0]
    assert cap["owner"] == cap["futureOwner"] == "appliance"
    assert len(cap["levels"]) == 9 and cap["audienceIds"] == []
    assert document["settings"]["ownerLabels"] == {"appliance": "Appliance", "federated": "Federated"}
    assert len(document["settings"]["audiences"]) == 5
    assert "Added the default maturity levels to 1 capabilities." in notes
    assert validate_document(document).ok


def test_partial_settings_keep_given_values():
    document, _ = migrate_v1({"version": 1, "settings": {"ownerLabels": {"appliance": "Device"}, "timeline": {"periods": 4}}, "capabilities": []}, "p", "2026-10-29T00:00:00Z")
    assert document["settings"]["ownerLabels"] == {"appliance": "Device", "federated": "Federated"}
    assert document["settings"]["timeline"]["periods"] == 4 and document["settings"]["timeline"]["granularity"] == "quarter"


def test_level_ids_are_unique_and_existing_ids_are_kept():
    levels = [{"name": "Draft"}, {"name": "Draft"}, {"id": "keep", "name": "Kept"}, {"name": "!!!"}, "not a level"]
    document, _ = migrate_v1({"capabilities": [{"id": "a", "name": "A", "levels": levels}]}, "p", "2026-10-29T00:00:00Z")
    assert [lvl["id"] if isinstance(lvl, dict) else lvl for lvl in document["capabilities"][0]["levels"]] == ["draft", "draft-2", "keep", "level-3", "not a level"]


def test_list_root_and_unversioned_documents_are_version_1():
    assert is_version_1([]) and is_version_1({"capabilities": []}) and is_version_1({"version": 1})
    assert not is_version_1({"version": 2}) and not is_version_1({"version": True}) and not is_version_1("x")
    document, _ = migrate_v1([{"id": "a", "name": "A", "current": 0, "target": 0}], "p", "2026-10-29T00:00:00Z")
    assert document["capabilities"][0]["id"] == "a"


def test_unknown_root_fields_are_preserved():
    document, _ = migrate_v1({"version": 1, "capabilities": [], "notes": "keep me"}, "p", "2026-10-29T00:00:00Z")
    assert document["notes"] == "keep me"
    assert any(i.code == "field.unsupported" for i in validate_document(document).issues)


@pytest.mark.parametrize("raw", [{"version": 2}, {"version": 3, "capabilities": []}, "text", None])
def test_only_version_1_can_be_migrated(raw):
    with pytest.raises(MigrationError):
        migrate_v1(raw, "p", "2026-10-29T00:00:00Z")


def test_slug_rules():
    assert slug("Audit Trail") == "audit-trail"
    assert slug("  Ünïcode & More!! ") == "n-code-more"
    assert slug(None) == "" and slug("---") == ""
    assert len(slug("x" * 200)) == 80
