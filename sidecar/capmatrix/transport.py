"""Transport layer: one newline-delimited JSON request in, one JSON response out."""

import json
from typing import IO

from .contracts.messages import SidecarResponse
from .service import handle


def serve_once(stdin: IO[str], stdout: IO[str]) -> None:
    line = stdin.readline()
    if not line:
        return
    try:
        response = handle(json.loads(line))
    except json.JSONDecodeError as exc:
        response = SidecarResponse(ok=False, error=f"Request is not valid JSON: {exc.msg}")
    except RecursionError:
        response = SidecarResponse(ok=False, error="Request is nested too deeply to validate.")
    stdout.write(response.to_json() + "\n")
    stdout.flush()
