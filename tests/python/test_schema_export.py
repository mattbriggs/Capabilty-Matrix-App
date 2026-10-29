"""The exported JSON Schema is generated from the Pydantic contract and must not drift."""

import json
import re

from capmatrix import schema_export
from capmatrix.schema_export import SCHEMA_PATH, project_schema, schema_text
from conftest import ROOT


def test_committed_schema_matches_the_contract():
    assert SCHEMA_PATH.read_text(encoding="utf-8") == schema_text(), "Run `npm run schema` after changing contracts/document.py"


def test_schema_declares_version_and_explains_its_limits():
    schema = project_schema()
    assert schema["$schema"].endswith("2020-12/schema")
    assert schema["properties"]["version"]["const"] == 2
    assert "application validator" in schema["description"]
    assert set(schema["required"]) == {"version", "project", "settings"}


def test_browser_validator_supports_every_keyword_the_schema_uses():
    source = (ROOT / "src" / "domain" / "schemaValidator.js").read_text()
    block = re.search(r"SUPPORTED_KEYWORDS = new Set\(\[(.*?)\]\)", source, re.S).group(1)
    supported = set(re.findall(r"'([^']+)'", block))
    used = set()

    def walk(node):
        if isinstance(node, dict):
            for key, value in node.items():
                used.add(key)
                if key in ("properties", "$defs"):
                    for child in value.values():
                        walk(child)
                elif key not in ("default", "const", "enum"):
                    walk(value)
        elif isinstance(node, list):
            for item in node:
                walk(item)

    walk(project_schema())
    assert used <= supported, used - supported


def test_cli_prints_or_writes(tmp_path, monkeypatch, capsys):
    assert schema_export.main([]) == 0
    assert json.loads(capsys.readouterr().out)["title"] == "Capability project document"
    target = tmp_path / "schema.json"
    monkeypatch.setattr(schema_export, "SCHEMA_PATH", target)
    assert schema_export.main(["--write"]) == 0
    assert json.loads(target.read_text())["$id"].endswith("v2.json")
