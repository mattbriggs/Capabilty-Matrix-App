"""Transport contracts: newline-delimited JSON requests from the Tauri shell and their responses.

Requests are a discriminated union on ``operation``. The ``document`` payload is
deliberately untyped here: it is raw input that the validation layer judges, so a
malformed document produces structured issues rather than an envelope error.
"""

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from .base import PROJECT_ID_PATTERN, TIMESTAMP_PATTERN
from .issues import Issue


class _Envelope(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class ValidateRequest(_Envelope):
    operation: Literal["validate"]
    document: Any


class MigrateOptions(_Envelope):
    projectId: str = Field(pattern=PROJECT_ID_PATTERN)
    now: str = Field(pattern=TIMESTAMP_PATTERN)
    name: str | None = None


class MigrateRequest(_Envelope):
    operation: Literal["migrate"]
    document: Any
    options: MigrateOptions


class ManifestRequest(_Envelope):
    operation: Literal["content-manifest"]
    document: Any


class SummaryRequest(_Envelope):
    operation: Literal["report-summary"]
    document: Any


class SchemaRequest(_Envelope):
    operation: Literal["schema"]


SidecarRequest = Annotated[
    Union[ValidateRequest, MigrateRequest, ManifestRequest, SummaryRequest, SchemaRequest],
    Field(discriminator="operation"),
]
request_adapter: TypeAdapter[SidecarRequest] = TypeAdapter(SidecarRequest)


class SidecarResponse(_Envelope):
    ok: bool
    issues: list[Issue] = Field(default_factory=list)
    error: str | None = None
    document: dict[str, Any] | None = None
    notes: list[str] | None = None
    manifest: list[dict[str, Any]] | None = None
    summary: dict[str, Any] | None = None
    schema_: dict[str, Any] | None = Field(default=None, alias="schema")

    def to_json(self) -> str:
        return self.model_dump_json(by_alias=True, exclude_none=True)
