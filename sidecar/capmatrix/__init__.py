"""Capability and Ownership Matrix document contracts, validation and migration.

Layers, from the outside in:

* ``capmatrix.transport`` reads newline-delimited JSON requests and writes responses.
* ``capmatrix.service`` dispatches validated request envelopes to operations.
* ``capmatrix.validation`` runs the version gate, structural (Pydantic) and semantic checks.
* ``capmatrix.migration`` converts version 1 documents to version 2 explicitly.
* ``capmatrix.contracts`` holds the Pydantic models that define every boundary.
"""

SUPPORTED_VERSION = 2
