#!/usr/bin/env python3
"""Newline-delimited JSON sidecar for the Tauri desktop shell.

Python is the desktop validation boundary: it validates complete version 2
project documents against the Pydantic contracts and semantic rules in
``capmatrix``, migrates version 1 documents, and prepares draft content/report
manifests. It does not publish to the CCMS or generate a production DITAVAL.
"""

import sys

from capmatrix.transport import serve_once


def main() -> None:
    serve_once(sys.stdin, sys.stdout)


if __name__ == "__main__":
    main()
