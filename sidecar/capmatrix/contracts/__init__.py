"""Pydantic contracts for every boundary the sidecar owns.

* ``document`` — the canonical version 2 project document (structural layer).
* ``issues`` — the structured validation issue and report shared with the browser.
* ``messages`` — the request/response envelopes exchanged with the Tauri shell.
"""

from .document import ProjectDocument
from .issues import Issue, ValidationReport
from .messages import SidecarRequest, SidecarResponse

__all__ = ["Issue", "ProjectDocument", "SidecarRequest", "SidecarResponse", "ValidationReport"]
