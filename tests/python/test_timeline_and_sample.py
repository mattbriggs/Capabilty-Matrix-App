"""Timeline rules shared with the browser, and the bundled sample project."""

import pytest
import yaml

from capmatrix.timeline import period_starts, real_date
from capmatrix.validation import validate_document
from conftest import ROOT, load_json
from test_migration import StringDateLoader

RULES = load_json("timeline/rules.json")


@pytest.mark.parametrize("value,expected", RULES["realDate"].items())
def test_real_dates(value, expected):
    assert (real_date(value) is not None) is expected


@pytest.mark.parametrize("case", RULES["periodStarts"], ids=lambda c: f"{c['granularity']}-{c['start']}")
def test_period_starts(case):
    assert period_starts(case["granularity"], case["start"], case["periods"]) == case["expected"]


def test_unknown_granularity_falls_back_to_quarters():
    assert period_starts("week", "2026-01-01", 2) == ["2026-01-01", "2026-04-01"]


def test_bundled_sample_is_a_clean_version_2_project():
    sample = yaml.load((ROOT / "src" / "data" / "capabilities.yaml").read_text(), Loader=StringDateLoader)
    report = validate_document(sample)
    assert report.ok and report.issues == []
    assert sample["version"] == 2 and len(sample["domains"]) == 3
