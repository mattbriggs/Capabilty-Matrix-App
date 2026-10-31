"""Generate the JSON Schema used by the browser's structural validator.

Run ``python -m capmatrix.schema_export --write`` from ``sidecar/`` (or
``npm run schema``) after changing ``contracts/document.py``. A test fails if the
committed schema drifts from the contract.
"""

import json
import sys
from pathlib import Path
from typing import Any

from . import SUPPORTED_VERSION
from .contracts.document import ProjectDocument

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "src" / "data" / "schema" / "capability-project.schema.json"
SCHEMA_ID = f"https://capability-matrix.local/schema/capability-project.v{SUPPORTED_VERSION}.json"


def project_schema() -> dict[str, Any]:
    schema = ProjectDocument.model_json_schema(by_alias=True, mode="validation")
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": SCHEMA_ID,
        "title": "Capability project document",
        "description": (
            f"Structural contract for version {SUPPORTED_VERSION} capability project documents. "
            "Cross-record rules (unique IDs, references, maturity bounds, timeline dates, cycles) "
            "require the application validator."
        ),
        **{key: value for key, value in schema.items() if key not in ("title", "description")},
    }


def schema_text() -> str:
    return json.dumps(project_schema(), indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str]) -> int:
    if "--write" in argv:
        SCHEMA_PATH.parent.mkdir(parents=True, exist_ok=True)
        SCHEMA_PATH.write_text(schema_text(), encoding="utf-8")
        print(f"Wrote {SCHEMA_PATH}")
    else:
        sys.stdout.write(schema_text())
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
