"""Shared fixture contract: the browser validator (tests/js/validation.test.mjs) must produce identical keys."""

import pytest

from capmatrix.validation import validate_document
from conftest import apply_case, issue_keys, load_json

CASES = load_json("validation/cases.json")


@pytest.mark.parametrize("case", CASES["cases"], ids=[case["name"] for case in CASES["cases"]])
def test_fixture_case(case):
    report = validate_document(apply_case(CASES["base"], case))
    assert issue_keys(report.issues) == case["expect"]
    assert report.ok == (not any(issue["severity"] == "error" for issue in case["expect"]))


def test_every_issue_has_a_corrective_message():
    for case in CASES["cases"]:
        for issue in validate_document(apply_case(CASES["base"], case)).issues:
            assert len(issue.message) > 20, (case["name"], issue)
