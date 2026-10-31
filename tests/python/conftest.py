import copy
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "tests" / "fixtures"
sys.path.insert(0, str(ROOT / "sidecar"))


def load_json(relative: str):
    return json.loads((FIXTURES / relative).read_text(encoding="utf-8"))


def apply_case(base: dict, case: dict):
    """Python twin of tests/fixtures/apply.mjs."""
    if "document" in case:
        return copy.deepcopy(case["document"])
    doc = copy.deepcopy(base)
    for path, value in case.get("set", {}).items():
        parts = [int(part) if part.isdigit() else part for part in path.split(".")]
        target = doc
        for part in parts[:-1]:
            target = target[part]
        if value == "$delete":
            del target[parts[-1]]
        else:
            target[parts[-1]] = copy.deepcopy(value)
    return doc


def issue_keys(issues) -> list[dict]:
    return [
        {"path": i.path, "code": i.code, "severity": i.severity, "entityType": i.entityType, "entityId": i.entityId}
        for i in issues
    ]


@pytest.fixture
def cases():
    return load_json("validation/cases.json")


@pytest.fixture
def base_document(cases):
    return copy.deepcopy(cases["base"])
