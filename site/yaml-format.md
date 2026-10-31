# YAML format reference

YAML is the canonical project document used by the Capability and Ownership Matrix. One YAML document is one project. This reference describes the version 2 format, field meanings, the CSV interchange format, and how validation works; use it with the [analyst user guide](guide.md) when preparing or reviewing project data.

## Document shape

A version 2 document is a YAML mapping with `version: 2`, a `project` record, `settings`, and the project's records. Only `version`, `project` and `settings` are required; every collection may be empty, so a new project with no capabilities is valid.

```yaml
version: 2
project:
  id: prj-k3m9x2q7aa1b        # immutable identity; renaming or moving the file never changes it
  name: Guidance roadmap
  description: Planning model for the 2027 guidance handoff.
  createdAt: 2026-10-29T09:00:00Z
  updatedAt: 2026-10-29T09:00:00Z
settings:
  ownerLabels:
    appliance: Appliance
    federated: Federated
  timeline:
    granularity: quarter
    start: 2026-10-01
    periods: 9
    asOf: 2026-10-01
  audiences:
    - id: client
      label: Client
      description: Uses and funds the capability
      need: Clear outcomes and a dependable operating experience.
capabilities:
  - id: contextual-guidance
    name: Contextual guidance
    summary: Relevant guidance at the point of need.
    decision: Agree on the handoff to a shared content service.
    owner: appliance
    futureOwner: federated
    handoffDate: 2028-10-01
    current: 3
    target: 5
    domainId: guidance
    audienceIds: [client]
    dependencies: [content-service]
    levels:
      - id: emerging
        name: Emerging
        description: Explore the need.
        outcomes: A shared problem statement.
        exitCriteria: Need confirmed by two client interviews.
      - id: initial
        name: Initial
      # … one entry per level, at least two and at most twenty
    milestones:
      - date: 2027-10-01
        maturity: 4
        note: Pilot with two clients.
    definition:
      purpose: Give people guidance at the point of need.
      scope: In-device help and contextual task guidance.
      exclusions: Authoring tools.
      outcomes: ''
      evidence: ''
      notes: ''
    journey:
      guidance:
        - audienceId: client
          levelId: initial
          text: In-device help covers common tasks.
    dita:
      audience: [client, consultant]
      maturity: phase-3
      ownership: appliance-native
    extensions: {}
domains:
  - id: guidance
    name: Guidance and content
    description: Help, guidance and governed content delivery.
    color: '#dfeef0'
timeSegments:
  - date: 2027-01-01
    label: Launch quarter
    description: First client release.
presentation:
  journeySections:
    - id: notes
      label: Remarks
      visible: false
  defaultGuidance:
    - audienceId: client
      levelId: managed
      text: Contextual guidance appears when needed.
  dataTable:
    xAxis: capability
    yAxis: audience
    filters: { search: '', capabilityIds: [] }
mapViews:
  - id: board-review
    name: Board review
    viewport: { x: 120, y: 40, zoom: 0.8 }
    placements:
      - { nodeId: cap:contextual-guidance, context: appliance/guidance, x: 0, y: 0, pinned: true }
extensions: {}
```

The bundled [capabilities.yaml](https://github.com/mattbriggs/Capabilty-Matrix-App/blob/main/src/data/capabilities.yaml) contains six illustrative capabilities and three domains. Its facts, IDs, maturity values, dependencies, audience wording, guidance and DITA metadata are examples, not an approved project model.

The app writes documents compactly: a field whose value equals its documented default (an empty string, empty list or `null`) is omitted, and loading fills it back in. Comments and formatting in a hand-edited file are not preserved when the app saves it.

## Identifiers

IDs are stable identities, not labels. Project IDs use letters, digits, `-` and `_` (up to 64 characters). Other IDs (capabilities, levels, audiences, domains, map views) start with a letter or digit and may also contain `.` (up to 80 characters). The app generates IDs from the first name you enter and never changes them when you rename a record.

## Project and settings

| Field | Required | Meaning |
| --- | --- | --- |
| `version` | Yes | Must be `2`. Version 1 files are migrated explicitly (see [Migrating version 1](#migrating-version-1)); later versions are rejected with a message to update the app. |
| `project.id` | Yes | Immutable project identity. |
| `project.name` | Yes | Display name; cannot be blank. |
| `project.description` | No | Free text. |
| `project.createdAt`, `project.updatedAt` | Yes | ISO 8601 timestamps, for example `2026-10-29T09:00:00Z`. The app updates `updatedAt` on every applied change. |
| `settings.ownerLabels.appliance`, `.federated` | Yes | Display labels for the fixed owner IDs `appliance` and `federated`. |
| `settings.audiences` | Yes, at least one | Perspectives with `id`, `label`, optional `description` (role) and `need`. |
| `settings.timeline.granularity` | Yes | `month`, `quarter`, `biannual` or `year`. |
| `settings.timeline.start` | Yes | Real calendar date (`YYYY-MM-DD`); the first segment starts on the first day of its month. |
| `settings.timeline.periods` | Yes | Whole number from 2 through 60. |
| `settings.timeline.asOf` | Yes | Date that anchors every capability's `current` maturity; must fall inside the timeline. |

## Capabilities

| Field | Required | Meaning and guidance |
| --- | --- | --- |
| `id`, `name` | Yes | Stable ID and display name. |
| `summary`, `decision` | No | Short description and the scope or ownership rationale. |
| `owner`, `futureOwner` | Yes | `appliance` or `federated`. Any other value is an error; it is never silently replaced. |
| `handoffDate` | No | Date the future owner takes over. If omitted, ownership changes at the last segment. A date outside the timeline is a warning. |
| `current`, `target` | Yes | Whole-number ranks into `levels` (M0 is the first level). `target` must be at least `current`, and both must exist in `levels`. |
| `levels` | Yes | 2–20 ordered levels. Each has a stable `id`, a `name`, and optional `description`, `outcomes` and `exitCriteria` (evidence or exit criteria). |
| `milestones` | No | Dated whole-number maturity points with an optional `note`. Each date must be real, unique, inside the timeline, and different from the `asOf` and final-segment anchors. Past dates are allowed. |
| `dependencies` | No | IDs of capabilities this one relies on. Missing IDs and self-references are errors; repeats and dependency cycles are warnings (the warning shows the cycle path). |
| `domainId` | No | One optional domain. Domain is separate from ownership. |
| `audienceIds` | No | Business audience membership. It drives the Matrix rows and the data table, and is separate from the proposed DITA audience mapping. |
| `definition` | No | `purpose`, `scope`, `exclusions`, `outcomes`, `evidence`, `notes`. Shown in the Capability journey; empty sections show an honest “Not recorded” state. |
| `journey.guidance` | No | Audience-specific guidance keyed by `audienceId` and `levelId`. Overrides `presentation.defaultGuidance` for this capability. |
| `dita` | No | Proposed DITA metadata (`audience`, `maturity`, `ownership`). It records intent only and is not a validated CCMS configuration. |
| `extensions` | No | Free-form custom data. Put your own fields here. |

Maturity at any date is calculated from the `asOf` anchor, dated milestones and the target at the last segment, rounding the linear interpolation between points. The Current and Focus selectors only inspect dates; they never move the anchors.

Reordering or removing levels in the app remaps `current`, `target`, milestones and guidance through level IDs and previews the effect before you apply it.

## Domains, time segments, presentation and map views

| Collection | Fields | Notes |
| --- | --- | --- |
| `domains` | `id`, `name`, `description`, `color` (`#rrggbb`) | A domain may contain capabilities with either owner; the map draws one region per owner. |
| `timeSegments` | `date`, `label`, `description` | Overrides only. Segments are generated from the timeline and identified by their start date. Overrides for dates outside the current timeline are kept (hidden), so a granularity change never deletes them. |
| `presentation.journeySections` | `id`, `label`, `visible` | Section IDs: `purpose`, `scope`, `exclusions`, `outcomes`, `evidence`, `notes`, `stageCriteria`, `audienceGuidance`. Omitted sections keep their default label and are visible. |
| `presentation.defaultGuidance` | `audienceId`, `levelId`, `text` | Reusable guidance shown for any capability that has a level with that ID. A level ID used by no capability is a warning. |
| `presentation.dataTable` | `xAxis`, `yAxis`, `filters` | Saved data-table layout. Axes are `capability`, `maturity`, `audience`, `domain` or `time` and must differ. |
| `mapViews` | `id`, `name`, `layoutSeed`, `layoutVersion`, `viewport`, `filters`, `selectedCapabilityId`, `audienceId`, `currentDate`, `focusDate`, `placements` | Named domain-map views. `viewport.zoom` must be greater than zero; coordinates must be finite numbers. Each placement remembers a node position for one owner/domain context (`cap:<id>` in `appliance/<domain>` and so on), so a card returns to where you left it when the Focus date brings it back to that context. References to deleted records are warnings and are pruned when the view opens. |

## Validation

Validation runs on the raw file before anything is applied, in three layers:

1. **Version gate.** Missing, version 1 (migration needed) and newer versions are reported first.
2. **Structure.** The [JSON Schema](https://github.com/mattbriggs/Capabilty-Matrix-App/blob/main/src/data/schema/capability-project.schema.json) generated from the Python (Pydantic) contract checks required fields, types, whole numbers, enums, formats and bounds. Values are never coerced: `"3"`, `1.5` and `true` are not maturity values.
3. **Cross-record rules.** Unique IDs, existing references, maturity within each capability's levels, target ≥ current, real calendar dates, timeline ranges, milestone collisions, guidance references, distinct table axes, map-view references and dependency cycles.

Fields the format does not define are reported as warnings and kept, never dropped; move custom data under `extensions` to silence the warning.

Errors block an import or an applied change; warnings do not. Each issue names its severity, a code, the record (`entityType`, `entityId`), the field `path` (for example `capabilities.0.target`) and a corrective message. In the Data workspace, selecting an issue opens the record and focuses the field.

The browser and the desktop app apply the same rules: the browser uses the generated schema and a twin of the Python rules, and a shared set of fixtures holds both to identical results. In the desktop app, the Python sidecar validates every change again before it is saved. The exported JSON Schema covers structure only; cross-record rules need the application validator.

## Migrating version 1

Import a version 1 file (or one with no `version` and a `capabilities` list) to migrate it. The app shows a preview first, then:

- assigns a new project ID and level IDs (from level names);
- keeps owner labels, audiences, timeline settings and every capability field;
- copies each capability's `dita.audience` into `audienceIds` (the DITA mapping itself is kept);
- adds the version 1 default levels to capabilities that had none, and `appliance` for a missing owner;
- starts domains, segment overrides and map views empty.

Invalid values are carried over unchanged so validation reports them. The original bytes are kept as `original-v1.yaml` beside the new project (desktop) or in the session (browser). On first launch, the desktop app migrates an earlier single `capabilities.yaml` once and leaves that file in place.

## CSV interchange

CSV export is lossless and re-importable. It uses one versioned file with the columns `format_version,record_type,record_id,parent_id,payload_json`, UTF-8 and standard CSV quoting. Record types are `project`, `settings`, `presentation`, `extensions`, `document` (unknown top-level fields), `domain`, `time-segment`, `capability` and `map-view`; nested values stay JSON in `payload_json`.

Import shows the record counts and any errors first, and rebuilds and validates the whole document before applying it. Unsupported format versions, unknown record types, duplicate rows and a `record_id` that disagrees with its payload are rejected. Third-party column layouts are not supported.

The **Export table report** button in the Data workspace writes a readable CSV of the current table. That file is a report and cannot be imported.
