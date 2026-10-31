"""Semantic layer and pipeline behaviour beyond the shared fixtures."""

import copy
import random

from capmatrix.validation import validate_document
from capmatrix.validation.issues import entity_for, sort_issues
from capmatrix.validation.semantic import semantic
from capmatrix.validation.pipeline import normalize_document
from capmatrix.contracts.issues import Issue


def with_deps(base, deps):
    doc = copy.deepcopy(base)
    for cap in doc["capabilities"]:
        cap["dependencies"] = deps.get(cap["id"], [])
    return doc


def test_cycle_message_names_the_full_route(base_document):
    doc = with_deps(base_document, {"alpha": ["beta"], "beta": ["gamma"], "gamma": ["alpha"]})
    [cycle] = [i for i in validate_document(doc).issues if i.code == "dependency.cycle"]
    assert "alpha → beta → gamma → alpha" in cycle.message
    assert cycle.severity == "warning" and cycle.entityId == "alpha"


def test_cycle_is_reported_once_from_its_smallest_id(base_document):
    doc = with_deps(base_document, {"gamma": ["beta"], "beta": ["gamma"]})
    cycles = [i for i in validate_document(doc).issues if i.code == "dependency.cycle"]
    assert len(cycles) == 1 and cycles[0].entityId == "beta"


def test_semantic_runs_only_after_structural_success(base_document):
    doc = copy.deepcopy(base_document)
    doc["capabilities"][0]["owner"] = "typo"
    doc["capabilities"][0]["dependencies"] = ["ghost"]
    codes = {i.code for i in validate_document(doc).issues}
    assert codes == {"schema.enum"}


def test_semantic_reads_the_defaults_filled_document(base_document):
    doc = normalize_document(base_document)
    assert semantic(doc) == []


def test_entity_attribution_for_every_collection(base_document):
    assert entity_for(base_document, []) == ("document", None)
    assert entity_for(base_document, ["project", "name"]) == ("project", "prj-fixture")
    assert entity_for(base_document, ["settings", "audiences", 1, "label"]) == ("audience", "consultant")
    assert entity_for(base_document, ["settings", "timeline", "start"]) == ("timeline", None)
    assert entity_for(base_document, ["settings", "ownerLabels"]) == ("settings", None)
    assert entity_for(base_document, ["capabilities", 0, "levels", 1, "name"]) == ("level", "alpha/l1")
    assert entity_for(base_document, ["capabilities", 9]) == ("capability", None)
    assert entity_for(base_document, ["domains", 0]) == ("domain", "core")
    assert entity_for(base_document, ["mapViews", 0, "viewport"]) == ("mapView", "main")
    assert entity_for(base_document, ["presentation", "dataTable"]) == ("presentation", None)
    assert entity_for({"timeSegments": [{"date": "2026-01-01"}]}, ["timeSegments", 0]) == ("timeSegment", "2026-01-01")
    assert entity_for(base_document, ["mystery"]) == ("document", None)
    assert entity_for("not a dict", ["capabilities", 0]) == ("capability", None)


def test_issue_ordering_is_deterministic():
    make = lambda path, code: Issue(severity="error", code=code, entityType="document", entityId=None, path=path, message="m")
    issues = [make("b", "x"), make("a", "y"), make("a", "x")]
    assert [(i.path, i.code) for i in sort_issues(issues)] == [("a", "x"), ("a", "y"), ("b", "x")]


def test_validator_never_raises_on_hostile_input(base_document):
    """Mutate the base document at random; validation must always return a report, never raise."""
    rng = random.Random(20261029)
    junk = [None, True, -1, 1.5, "", "x" * 300, [], {}, [None], {"a": {"b": []}}, "2026-02-30"]

    def paths(node, prefix=()):
        yield prefix
        if isinstance(node, dict):
            for key, value in node.items():
                yield from paths(value, (*prefix, key))
        elif isinstance(node, list):
            for index, value in enumerate(node):
                yield from paths(value, (*prefix, index))

    all_paths = [p for p in paths(base_document) if p]
    for _ in range(400):
        doc = copy.deepcopy(base_document)
        path = rng.choice(all_paths)
        target = doc
        for part in path[:-1]:
            target = target[part]
        target[path[-1]] = copy.deepcopy(rng.choice(junk))
        report = validate_document(doc)
        assert all(issue.path is not None for issue in report.issues)
    for raw in (None, [], "text", 7, {"version": 2}, {"version": 2, "settings": None}):
        assert not validate_document(raw).ok
