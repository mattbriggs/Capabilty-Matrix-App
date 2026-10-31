# Implementation update 1: project management, data workspace and domain map

**Status:** Proposed requirements and implementation guide; no feature implementation in this update.  
**Prepared:** 2026-10-29; filename retains the requested 2026-10-26 date.  
**Scope:** Preserve Matrix and Capability journey; add Projects and Data workspace; improve Domain map. React, Tauri 2, Python and canonical YAML remain the architecture.

## 1. Code review and implications

Reviewed `src/App.jsx`, `src/Views.jsx`, `src/model.js`, `src/sidecarBridge.js`, `src/styles.css`, bundled YAML, `sidecar/main.py`, `src-tauri/src/lib.rs`, build configuration, Sites tests and existing design specifications. Earlier SRS references to Current/Future and CCMS vendor names are superseded by the current AGENTS.md decisions.

| Priority | Observed implementation | Required response |
| --- | --- | --- |
| High | `src/App.jsx` owns records, settings, dialogs, import/export and persistence. Rust `load_yaml`/`save_yaml` address one app-data `capabilities.yaml`; saving writes directly to that file. | Introduce a project repository, stable project identity, atomic writes and recovery before adding multi-project CRUD. |
| High | `src/sidecarBridge.js:3` returns success immediately in the browser. `src/model.js:160` coerces owners and numbers and discards malformed milestones; `normalizeDocument` drops the input version and other root fields. | Validate raw input before normalization; separate explicit migration from validation and preserve the complete document. |
| High | Python checks capabilities and direct dependency references, but ignores settings and does not fully validate dates, integer maturity or milestone constraints. | Use a versioned schema plus semantic validation with equivalent browser/desktop results. |
| High | `src/Views.jsx:87` supplies sample-specific map coordinates; MapView disables dragging, constrains zoom and renders owner areas outside the graph viewport. | Replace sample layout with controlled graph state, dynamic graph-space regions and persisted views. |
| Medium | Matrix uses sample `matrixRows` and `initialCapabilities`; fallback audience rows show at most two capabilities. Journey uses hard-coded `audienceMilestones`. | Derive records and guidance from project data. Keep the familiar presentation while removing sample-dependent omissions. |
| Medium | Existing drawers edit capabilities, levels and dependencies; audiences and timeline live in Settings. Domains and saved map views have no document model. | Reuse drawer anatomy with entity-specific forms and introduce explicit domain/view records. |
| Medium | Current components dereference the selected capability; normalization rejects an empty capability list. | Support a valid empty project with clear create/import actions before project creation or last-record deletion ships. |

**Verification:** Vite frontend compilation succeeded. `npm run build` then failed because `.openai/hosting.json` is missing. `npm run test:sites` passed 4/4 against existing `dist` artifacts; this does not prove a clean build. Direct model probes accepted version `999` (then dropped it), owner `typo` (changed to `appliance`), maturity `1.5`, target below current, an impossible date and a missing dependency. A Python probe returned success for fractional maturity, an invalid milestone date and negative milestone maturity. These are observed validation gaps, not just proposed enhancements. Desktop packaging and native interaction were not tested. Local preview was started and opened.

## 2. Required user workflows

### R1 — Separate management from exploration

Keep Matrix, Capability journey and Domain map navigable with shared selected capability, audience, Current and Focus dates. Add **Projects** for file/project management and **Data workspace** for entry, table editing and validation. Neither replaces a concept view. Show active project and saved/unsaved/error status throughout. Returning from management restores the exploration context; an empty project shows an empty state instead of crashing.

### R2 — Manage YAML-backed projects

Projects supports create, list/search, open, rename/update, delete, YAML/CSV import and YAML/CSV export. Export JSON Schema is a separate action. Each YAML contains immutable `project.id`, editable name/description and timestamps; renaming or moving a file does not change identity. One document is one project; its file path is storage metadata, not identity.

Desktop stores `<app-data>/projects/<project-id>/capabilities.yaml`; a rebuildable local index supplies names, modification times and locations. Delete moves the managed project to recoverable trash with Restore. External import copies a document into managed storage; deleting a managed copy never deletes its original source. Same-ID import offers Open existing, Replace after preview, or Import as copy with a new ID. No implicit merge or overwrite.

Browser Projects manages multiple documents in the current session, imports files and downloads exports; show that refresh loses unexported work. Ask Save/export, Discard or Cancel when switching away from dirty work, including drawers and map layouts; warn on browser unload where supported. Desktop reports Saved only after successful persistence. Failed writes leave the working copy and previous valid file recoverable.

### R3 — Enter and validate data in one workspace

Provide an entity list, configurable table, reusable editing tray and persistent validation panel. Support create/read/update/delete for capabilities, per-capability maturity levels, audiences, domains and time segments. Search/filter the table and validation results. Clicking an issue opens the exact record/field; show severity, useful explanation and corrective action.

Validate field edits promptly; validate the entire candidate document before applying a save/import. Errors block commit, warnings do not. Keep invalid work as an explicitly unsaved draft that can be corrected or cancelled. Deletion previews affected references and requires explicit reassignment/removal; never silently cascade. Stable IDs are not editable labels. Allow undo of the last applied data operation; recoverable project deletion uses Restore.

### R4 — Edit a table with independently chosen axes

X and Y selectors offer **Capability, Maturity stage, Audience, Domain, Time segment**. Disable the dimension already chosen on the other axis; Swap exchanges both selections in one action. Support all 20 ordered distinct pairs. Persist axes and filters per project.

Use a common relation projection: at Focus date, each capability contributes its ID, audience memberships, domain membership, capability-qualified maturity stage and containing time segment. When Time segment is an axis, evaluate maturity and ownership at each segment start. Pair two dimensions by projecting these facts; each cell lists matching capabilities with count and a drill-down for multiple matches. Empty means “No recorded relationship,” never zero maturity. An Unassigned bucket makes missing optional memberships visible.

| Example axes | Cell meaning / editing |
| --- | --- |
| Capability × Maturity | Capability occupies that stage at Focus; open capability or its level definition. |
| Audience × Capability | Recorded audience membership; add/remove through an explicit membership control. |
| Capability × Domain | Domain assignment, separate from ownership. |
| Capability × Time segment | Calculated maturity and owner at segment start; edit the dated milestone, not the calculated number. |
| Audience × Domain (or another aggregate pair) | Capabilities shared by both headings; drill down before editing an individual relationship. |

Headers open that dimension's object tray; capability chips open the capability tray. Provide an explicit “Edit relationship” action where applicable. Bare-cell clicks never guess which of several objects to edit. With Maturity on an axis, require a capability filter to avoid conflating unrelated level definitions. Time-segment headings edit labels/notes; structural dates follow the timeline rules below. Keyboard navigation, visible focus, sticky headers and row/column virtualization keep large tables usable.

### R5 — Configure journey and definition information

Add capability definition fields: purpose, scope/inclusions, exclusions, outcomes, evidence/references and notes. Add level outcomes and evidence/exit criteria, plus audience-specific guidance keyed by audience and level IDs. Expose these in the entity trays and render them in Journey. Project settings configure section labels, visibility and reusable default guidance; per-capability content overrides defaults. Preserve existing summary, decision, level name/description and editable audience needs. Missing content has an honest empty state; sample prose is never presented as recorded project evidence.

### R6 — Make the domain map scale and remain editable

Preserve the soft colored blob appearance. Represent Appliance and Federated as owner anchor nodes (labels remain editable; IDs remain `appliance`/`federated`). Domain subgraphs connect to the relevant owner anchor at Focus; dependency edges remain distinct from membership edges. A domain spanning both owners renders owner-specific regions linked to the same logical domain. A capability has one optional domain in this release; unassigned capabilities use a visible Unassigned region.

Generate organic positions from dependency links, owner/domain attraction and collision avoidance using measured card dimensions. Size each region from its member-card envelope plus padding; calculate blob paths in graph coordinates so they pan/zoom with cards. Handle empty, single-card, disconnected and highly uneven groups. Group labels remain legible and do not cover cards.

Enable pan, zoom buttons, zoom percentage, pinch/scroll zoom, Fit all and Fit selection. Fit all must include every visible card and anchor without clipping. Dragging cards records coordinates and pins them; manual position changes do not change domain or owner. Existing cards retain positions as data changes; new cards are placed near their group without overlap. Changing Focus recalculates membership, with saved coordinates stored per owner/domain placement context so returning restores the previous arrangement.

Named project-local views support create, select/read, rename/update, duplicate and delete. Save positions/pins, viewport, filters, selected capability, audience, Current/Focus dates and layout seed/version. Save updates the active view; Save as creates another. Reopen restores it. A working view is marked dirty until saved. **Rebuild layout** previews a seeded organic arrangement; preserve pins by default, offer explicit Reset manual positions, and support Apply/Cancel and Undo. Never replace another saved view implicitly. Deleted capability references are pruned with a notice; new cards appear without invalidating the view.

## 3. Data contract and validation

Introduce document `version: 2` with `project`, existing `settings` and `capabilities`, plus `domains`, `timeSegments`, `presentation` and `mapViews`. Extend capabilities with `domainId`, independent `audienceIds`, `definition` and configurable `journey`. Maturity levels gain immutable IDs while retaining ordered numeric ranks for current/target/milestones; reordering/removing levels must remap references through IDs and preview effects. Keep DITA audience mappings separate from business audience membership after migration.

Time segments are generated from timeline granularity/start/count and identified by ISO start date; store only label/description overrides keyed by date. Creation/deletion changes timeline range/count through its tray, with an impact preview. Granularity changes regenerate headings without changing ISO milestone dates or deleting temporarily hidden segment annotations. Keep `current` maturity anchored at `settings.timeline.asOf`, `target` at the final period; Current/Focus selectors inspect dates and do not rewrite those anchors. Preserve the existing rounded linear interpolation rule. Duplicate milestone dates and collisions with anchor dates are errors. Milestones may record past dates, but must lie within the configured timeline; use real calendar-date validation.

Schema validates structure, required fields, types, supported version, owner enums and bounds. Semantic checks enforce unique IDs, existing references, integer maturity within each capability's levels, target ≥ current, valid timeline/segment dates, positive finite viewport zoom and finite coordinates. Dependency self-links are errors; dependency cycles are warnings with the cycle path (planning graphs may contain mutual dependencies). Empty capability/domain/view collections are valid. Reserve an `extensions` object for custom data; report unsupported fields rather than dropping them. Unknown future versions are rejected with a useful message.

Migrate version 1 explicitly: back up original bytes, assign project/level IDs, retain owner/audience/timeline settings and all capability details, copy `dita.audience` into initial business `audienceIds`, initialize optional domains and views empty, and require preview before writing version 2. Invalid source values remain visible as errors; do not repair them silently. Migration/export round trips preserve defined fields and extensions; YAML comments/formatting are not guaranteed and the original import remains downloadable.

**Interchange:** YAML is the complete portable project, including saved views. CSV import/export uses one versioned CSV with columns `format_version,record_type,record_id,parent_id,payload_json`; typed rows cover project, settings, presentation, domain, time-segment override, capability and map view. Nested arrays/objects remain JSON in `payload_json`, with standard CSV quoting and UTF-8 encoding. Preview types/counts/errors before import and validate the reconstructed document atomically. Reject duplicate/conflicting rows and unsupported format versions. Arbitrary third-party CSV column mapping is outside this release. A readable export of the currently filtered table is a separate, explicitly non-round-trip report. Schema export returns the exact versioned JSON Schema used for structural validation; explain that cross-record rules require the application validator.

## 4. Implementation sequence

1. **Contract and regression baseline.** Add `src/data/schema/capability-project.schema.json`, pure document validation/migration/serialization modules and shared positive/negative fixtures. Extract complete document state from `App.jsx`; use one reducer/service for transactional edits and revisions. Resolve the missing hosting input from the established project configuration before claiming Sites readiness; preserve the protected hosting/worker/build/test files.
2. **Repository and Projects.** Add a storage interface with desktop/session-browser adapters. Extend Rust commands for managed project CRUD, trash/restore and atomic temp-file replacement; constrain paths to generated project IDs. Detect external changes via revision/hash before overwrite; on conflict offer reload or save a copy. Migrate the legacy app-data file once without deleting it. Serialize saves per project and reject stale commits so fast edits cannot overwrite newer work.
3. **Data workspace.** Extract existing panels into `src/components/`; add `src/features/projects/` and `src/features/data/`. Use an entity registry for tray selection and shared reference-impact handling. Implement the relation projection as pure selectors, separate calculated cells from editable records, and add CSV/schema actions.
4. **Journey and Matrix.** Replace hard-coded milestone prose and sample row logic with validated project selectors. Add configurable definition/guidance sections and retain selection/timeline behavior across all views.
5. **Map.** Keep existing React Flow rendering; move controlled nodes, edges and viewport into `src/features/map/`. Isolate a deterministic, bounded organic-layout worker from rendering and persistence. Persist drag-end/view-save operations rather than every pointer movement. Cache by graph revision/context/seed; cancel obsolete layout runs and commit only the latest result. Draw blobs behind nodes inside the transformed graph layer.
6. **Release validation.** Run browser/desktop validation parity fixtures, migration/interchange round trips, repository failure/recovery checks and end-to-end flows below. Then run the frontend and Sites builds/tests on clean output; verify `dist/client/index.html`, `dist/server/index.js`, `dist/.openai/hosting.json`. Native persistence/print still requires a Tauri check. Keep CCMS publishing and PDF-manual generation as future integrations.

Do not duplicate validation rules in forms: browser and Python consume the same schema and semantic fixture contract; Python remains the desktop validation boundary. Return structured issues `{severity, code, entityType, entityId, path, message}`. Model validation and UI field validation share selectors/rules; storage never accepts an unvalidated committed revision.

## 5. Acceptance and completeness gates

| Gate | Passing evidence |
| --- | --- |
| A1 — Projects (R1–R2) | Create an empty project; populate, rename, reopen and delete/restore it. Another project remains unchanged. Same-ID import, dirty switching, failed save and external conflict preserve work. Browser refresh warning accurately describes session storage. |
| A2 — Entry (R3) | All five object types open the correct tray from the table. Apply/Cancel, reference reassignment, last-capability deletion and undo work. Selecting a validation issue focuses the offending field. |
| A3 — Axes (R4) | Exercise all 20 ordered distinct pairs and Swap; same-axis selection is impossible. Multi-match/empty/unassigned cells and per-capability stage filtering follow the defined semantics. |
| A4 — Configuration (R5) | Edit definition, stage criteria and audience guidance; change section visibility; reopen YAML and confirm Journey renders the edits for an added audience without sample-specific code. |
| A5 — Map (R6) | Test 0, 1, 50 and 250 cards, uneven domains and cross-owner links. Generated cards do not overlap; blobs contain their cards; Fit all includes the full graph. Drag/reopen, Focus changes, rebuild cancel/undo, pins and named-view CRUD retain the intended positions/context. |
| A6 — Data integrity | Browser/Python agree on valid and invalid fixtures, including observed review failures. Version 1 → 2 migration, YAML and CSV round trips preserve semantic equality (excluding documented timestamps/new migration IDs). Schema export matches the validator schema. |
| A7 — Speed/accessibility | On a recorded reference machine with 250 capabilities, 20 audiences and 60 periods: local filter/axis actions p95 ≤200 ms; open/validate ≤1 s; organic rebuild ≤3 s with progress/cancel. Measure after warm-up across 20 runs. Keyboard-only operation reaches table/tray/map controls; Escape closes with dirty protection and restores focus; errors are announced without relying on color. |
| A8 — Regression/recovery | Existing Matrix/Journey selection, timelines, levels, owner labels, CCMS wording, YAML and native/browser print still work. Interrupted writes retain the previous valid project. Clean packaging and relevant native checks pass. |

## 6. Ten-category editorial review

Scores assess this specification's readiness against the stated rubric, not measured application performance or proof of future code quality. First-pass gaps were revised before the final review; implementation earns acceptance only through §5.

| Category | First pass | Final | Revision supporting 10/10 document readiness |
| --- | --- | --- | --- |
| 1. Workflow speed | 8 | 10 | Search, direct issue navigation, preserved context and non-blocking layout. |
| 2. User clarity | 8 | 10 | Distinct Projects/Data workspace roles; explicit cell and save meanings. |
| 3. Request completeness | 9 | 10 | Every requested CRUD, format, object tray, axis and map operation covered by R1–R6. |
| 4. Editing safety | 7 | 10 | Draft/commit distinction, impact preview, undo, trash and conflict recovery. |
| 5. Validation consistency | 7 | 10 | Raw validation, shared schema/fixtures, semantic rules and navigable issues. |
| 6. Data portability | 7 | 10 | Versioned migration, full-document retention and defined CSV round trip. |
| 7. Architecture quality | 8 | 10 | Repository boundary, pure selectors, entity forms and isolated layout. |
| 8. State/persistence quality | 7 | 10 | Immutable IDs, serialized revision-aware saves and context-specific layouts. |
| 9. Scale/accessibility | 7 | 10 | Virtualization, bounded worker, measurable budgets and keyboard gates. |
| 10. Testability/delivery | 8 | 10 | Traceable acceptance gates, staged dependencies and honest build baseline. |

**Completeness review:** All user notes map to requirements and acceptance evidence. Proposed defaults resolve ambiguous areas: domain membership is separate from ownership; stage definitions remain capability-specific; CSV has a lossless application format; richer journey information uses explicit fields plus configurable sections. These are implementation proposals, not claims of prior user approval. No additional decisions block a first implementation using these defaults.
