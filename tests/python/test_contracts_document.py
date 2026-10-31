"""Structural layer: the Pydantic document contract."""

import copy
import json
import math

import pytest
from pydantic import ValidationError

from capmatrix.contracts.document import Capability, MapView, Presentation, ProjectDocument, Viewport
from capmatrix.validation.pipeline import normalize_document
from conftest import load_json


def cap(**overrides):
    base = {"id": "a", "name": "A", "owner": "appliance", "futureOwner": "federated", "current": 0, "target": 1,
            "levels": [{"id": "l0", "name": "Zero"}, {"id": "l1", "name": "One"}]}
    return {**base, **overrides}


def test_valid_base_round_trips_through_the_model(base_document):
    model = ProjectDocument.model_validate(base_document)
    dumped = model.model_dump(mode="json", by_alias=True)
    assert ProjectDocument.model_validate(dumped).model_dump(mode="json", by_alias=True) == dumped


def test_defaults_match_the_shared_golden(base_document):
    # The browser's schema-driven defaults are tested against the same file (tests/js/validation.test.mjs).
    assert normalize_document(base_document) == load_json("normalize/base.expected.json")


def test_serializes_camel_case_and_accepts_snake_case_names():
    model = Capability.model_validate(cap(future_owner="appliance", futureOwner=None) | {"futureOwner": "appliance"})
    assert "futureOwner" in model.model_dump(by_alias=True)
    by_name = Capability.model_validate({k if k != "futureOwner" else "future_owner": v for k, v in cap().items()})
    assert by_name.future_owner == "federated"


@pytest.mark.parametrize("value", ["1", 1.5, True, None])
def test_strict_integers_reject_coercible_values(value):
    with pytest.raises(ValidationError):
        Capability.model_validate(cap(current=value))


@pytest.mark.parametrize("field,value", [("owner", "typo"), ("owner", "Appliance"), ("levels", [{"id": "l0", "name": "Zero"}]), ("id", "has space"), ("name", "  ")])
def test_constraints_reject_invalid_values(field, value):
    with pytest.raises(ValidationError):
        Capability.model_validate(cap(**{field: value}))


def test_too_many_levels():
    levels = [{"id": f"l{i}", "name": f"L{i}"} for i in range(21)]
    with pytest.raises(ValidationError):
        Capability.model_validate(cap(levels=levels))


@pytest.mark.parametrize("zoom", [0, -1, math.inf, math.nan])
def test_viewport_zoom_must_be_positive_and_finite(zoom):
    with pytest.raises(ValidationError):
        Viewport.model_validate({"x": 0, "y": 0, "zoom": zoom})


@pytest.mark.parametrize("coordinate", [math.inf, -math.inf, math.nan])
def test_coordinates_must_be_finite(coordinate):
    with pytest.raises(ValidationError):
        MapView.model_validate({"id": "v", "name": "V", "viewport": {"x": 0, "y": 0, "zoom": 1}, "placements": [{"nodeId": "cap:a", "context": "c", "x": coordinate, "y": 0}]})


def test_integer_coordinates_are_accepted_as_numbers():
    view = MapView.model_validate({"id": "v", "name": "V", "viewport": {"x": 1, "y": 2, "zoom": 1}})
    assert view.viewport.zoom == 1.0


def test_unknown_fields_are_kept_not_dropped(base_document):
    doc = copy.deepcopy(base_document)
    doc["colour"] = "blue"
    doc["capabilities"][0]["priority"] = {"level": "high"}
    dumped = normalize_document(doc)
    assert dumped["colour"] == "blue"
    assert dumped["capabilities"][0]["priority"] == {"level": "high"}


def test_extensions_accept_arbitrary_json(base_document):
    doc = copy.deepcopy(base_document)
    doc["capabilities"][0]["extensions"] = {"nested": {"list": [1, "two", None, True]}}
    assert normalize_document(doc)["capabilities"][0]["extensions"]["nested"]["list"][1] == "two"


def test_mutable_defaults_are_not_shared():
    a = Capability.model_validate(cap())
    b = Capability.model_validate(cap(id="b"))
    a.milestones.append("x")
    a.definition.purpose = "changed"
    assert b.milestones == [] and b.definition.purpose == ""
    assert Presentation().journey_sections is not Presentation().journey_sections


def test_empty_collections_are_valid(base_document):
    doc = copy.deepcopy(base_document)
    doc.update(capabilities=[], domains=[], mapViews=[], presentation={})
    model = ProjectDocument.model_validate(doc)
    assert model.capabilities == [] and len(model.presentation.journey_sections) == 8


def test_version_must_be_exactly_two(base_document):
    for version in (1, 3, "2", True):
        with pytest.raises(ValidationError):
            ProjectDocument.model_validate({**base_document, "version": version})


def test_dump_is_json_serializable(base_document):
    json.dumps(normalize_document(base_document))
