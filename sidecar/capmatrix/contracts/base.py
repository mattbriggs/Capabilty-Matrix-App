"""Shared constrained types and the base contract configuration."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$"
PROJECT_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$"
DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"
TIMESTAMP_PATTERN = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$"
COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"
NOT_BLANK_PATTERN = r"\S"

Id = Annotated[str, Field(pattern=ID_PATTERN)]
ProjectId = Annotated[str, Field(pattern=PROJECT_ID_PATTERN)]
# Structure only; real calendar dates are a semantic rule so browser and Python agree.
IsoDate = Annotated[str, Field(pattern=DATE_PATTERN)]
Timestamp = Annotated[str, Field(pattern=TIMESTAMP_PATTERN)]
Label = Annotated[str, Field(pattern=NOT_BLANK_PATTERN, max_length=200)]
Text = Annotated[str, Field(max_length=20000)]
FiniteFloat = Annotated[float, Field(allow_inf_nan=False)]

Owner = Literal["appliance", "federated"]
Granularity = Literal["month", "quarter", "biannual", "year"]
Dimension = Literal["capability", "maturity", "audience", "domain", "time"]


class Contract(BaseModel):
    """Strict camelCase contract that keeps (and later reports) unknown fields."""

    model_config = ConfigDict(
        strict=True,
        extra="allow",
        alias_generator=to_camel,
        validate_by_name=True,
        validate_by_alias=True,
        serialize_by_alias=True,
    )
