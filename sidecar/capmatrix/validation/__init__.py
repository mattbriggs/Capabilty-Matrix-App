"""Validation pipeline: version gate → structural contract → unsupported fields → semantic rules."""

from .pipeline import validate_document

__all__ = ["validate_document"]
