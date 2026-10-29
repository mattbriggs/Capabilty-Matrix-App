"""Structural contract for the version 2 capability project document.

This model is the single source of the exported JSON Schema
(``src/data/schema/capability-project.schema.json``). Cross-record rules live in
``capmatrix.validation.semantic`` because JSON Schema cannot express them.
"""

from typing import Any, Literal

from pydantic import Field

from .base import (
    COLOR_PATTERN,
    Contract,
    Dimension,
    FiniteFloat,
    Granularity,
    Id,
    IsoDate,
    Label,
    Owner,
    ProjectId,
    Text,
    Timestamp,
)

JourneySectionId = Literal[
    "purpose", "scope", "exclusions", "outcomes", "evidence", "notes", "stageCriteria", "audienceGuidance",
]

DEFAULT_JOURNEY_SECTIONS: list[tuple[str, str]] = [
    ("purpose", "Purpose"),
    ("scope", "Scope and inclusions"),
    ("exclusions", "Exclusions"),
    ("outcomes", "Outcomes"),
    ("evidence", "Evidence and references"),
    ("notes", "Notes"),
    ("stageCriteria", "Stage outcomes and exit criteria"),
    ("audienceGuidance", "Why it matters at each stage"),
]


class ProjectMeta(Contract):
    id: ProjectId = Field(description="Immutable project identity. Renaming or moving the file never changes it.")
    name: Label
    description: Text = ""
    created_at: Timestamp
    updated_at: Timestamp


class OwnerLabels(Contract):
    appliance: Label
    federated: Label


class Audience(Contract):
    id: Id
    label: Label
    description: Text = ""
    need: Text = ""


class Timeline(Contract):
    granularity: Granularity
    start: IsoDate
    periods: int = Field(ge=2, le=60)
    as_of: IsoDate


class Settings(Contract):
    owner_labels: OwnerLabels
    audiences: list[Audience] = Field(min_length=1)
    timeline: Timeline


class Level(Contract):
    id: Id = Field(description="Immutable level identity; the numeric rank is the level's position.")
    name: Label
    description: Text = ""
    outcomes: Text = ""
    exit_criteria: Text = ""


class Milestone(Contract):
    date: IsoDate
    maturity: int = Field(ge=0)
    note: Text = ""


class Definition(Contract):
    purpose: Text = ""
    scope: Text = ""
    exclusions: Text = ""
    outcomes: Text = ""
    evidence: Text = ""
    notes: Text = ""


class GuidanceEntry(Contract):
    audience_id: Id
    level_id: Id
    text: Text


class CapabilityJourney(Contract):
    guidance: list[GuidanceEntry] = Field(default=[])


class Dita(Contract):
    """Proposed DITA mapping. Records intent only; never a validated CCMS configuration."""

    audience: list[str] = Field(default=[])
    maturity: str | None = None
    ownership: str | None = None


class Capability(Contract):
    id: Id
    name: Label
    summary: Text = ""
    decision: Text = ""
    owner: Owner
    future_owner: Owner
    handoff_date: IsoDate | None = None
    current: int = Field(ge=0)
    target: int = Field(ge=0)
    levels: list[Level] = Field(min_length=2, max_length=20)
    milestones: list[Milestone] = Field(default=[])
    dependencies: list[Id] = Field(default=[])
    domain_id: Id | None = None
    audience_ids: list[Id] = Field(default=[])
    definition: Definition = Field(default=Definition())
    journey: CapabilityJourney = Field(default=CapabilityJourney())
    dita: Dita = Field(default=Dita())
    extensions: dict[str, Any] = Field(default={})


class Domain(Contract):
    id: Id
    name: Label
    description: Text = ""
    color: str | None = Field(default=None, pattern=COLOR_PATTERN)


class TimeSegmentOverride(Contract):
    """Label/description override for a generated time segment, keyed by its ISO start date."""

    date: IsoDate
    label: Text = ""
    description: Text = ""


class JourneySection(Contract):
    id: JourneySectionId
    label: Label
    visible: bool = True


class TableFilters(Contract):
    search: Text = ""
    capability_ids: list[Id] = Field(default=[])


class DataTableConfig(Contract):
    x_axis: Dimension = "capability"
    y_axis: Dimension = "audience"
    filters: TableFilters = Field(default=TableFilters())


def _default_sections() -> list["JourneySection"]:
    return [JourneySection(id=ident, label=label) for ident, label in DEFAULT_JOURNEY_SECTIONS]


class Presentation(Contract):
    journey_sections: list[JourneySection] = Field(default=_default_sections())
    default_guidance: list[GuidanceEntry] = Field(default=[])
    data_table: DataTableConfig = Field(default=DataTableConfig())


class Viewport(Contract):
    x: FiniteFloat
    y: FiniteFloat
    zoom: FiniteFloat = Field(gt=0)


class MapFilters(Contract):
    owners: list[Owner] = Field(default=[])
    domain_ids: list[Id] = Field(default=[])
    search: Text = ""


class Placement(Contract):
    """A remembered node position for one owner/domain placement context."""

    node_id: str = Field(min_length=1, max_length=200)
    context: str = Field(min_length=1, max_length=200)
    x: FiniteFloat
    y: FiniteFloat
    pinned: bool = False


class MapView(Contract):
    id: Id
    name: Label
    layout_seed: int = Field(default=1, ge=0)
    layout_version: int = Field(default=1, ge=1)
    viewport: Viewport
    filters: MapFilters = Field(default=MapFilters())
    selected_capability_id: Id | None = None
    audience_id: Id | None = None
    current_date: IsoDate | None = None
    focus_date: IsoDate | None = None
    placements: list[Placement] = Field(default=[])


class ProjectDocument(Contract):
    version: Literal[2]
    project: ProjectMeta
    settings: Settings
    capabilities: list[Capability] = Field(default=[])
    domains: list[Domain] = Field(default=[])
    time_segments: list[TimeSegmentOverride] = Field(default=[])
    presentation: Presentation = Field(default=Presentation())
    map_views: list[MapView] = Field(default=[])
    extensions: dict[str, Any] = Field(default={})
