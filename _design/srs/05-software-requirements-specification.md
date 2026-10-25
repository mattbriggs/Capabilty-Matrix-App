# Software Requirements Specification

**Product:** Capability and Ownership Matrix  
**Version:** Draft 0.1 · **Date:** 2026-10-25  
**Status:** Requirements for review. “Prototype” means demonstrable in the current React preview, not production accepted. “Future” means a proposed requirement awaiting its owner’s confirmation.

## 1. Purpose and scope

The application supports strategic planning for a technology appliance within a federated environment. It presents capability maturity, audience perspective, ownership, dependency, current/future state, and content mappings through three linked views. It should help stakeholders identify scope, understand other audiences' needs, and negotiate responsibility handoffs. The delivered prototype uses sample YAML records and a draft DITA mapping panel.

The intended client is a Tauri 2 desktop app with a React/Vite frontend and Python sidecar. A browser preview exposes most visual interactions, import/export, and printing, but it has different persistence and sidecar validation behavior. See [04 — Data and integration](04-data-integration-specification.md) for exact current interfaces.

## 2. Users and operational context

| User | Primary task |
| --- | --- |
| Client | Understand delivered capability and usable guidance |
| Consultant | Plan installation, client fit, and handoff |
| Product team | Define appliance scope and metadata contracts |
| Leadership | Assess investment, boundary, and risk |
| Wider-domain stakeholder | Relate local capability to the evolving ecosystem |

The five labels are the current prototype set (`src/model.js:1-7`). They require project-owner approval. The app is designed for planning meetings and individual analysis. Multi-user synchronization and authorization roles are not currently defined.

## 3. Functional requirements

| ID | Requirement and observable acceptance | Delivery status | Evidence |
| --- | --- | --- | --- |
| FR-01 | The user can navigate among Matrix, Capability Journey, and Federated Domain Map. Navigation preserves selected capability, audience, and state. | Prototype | `src/App.jsx:55-101`; [three captures](README.md#visual-evidence) |
| FR-02 | The user can select a capability from the global control, a Matrix bar, or a Map node; the selected name is reflected in every view. | Prototype | `src/App.jsx:95,99-101`; `src/Views.jsx:24-35,73-80` |
| FR-03 | The user can choose one of the five current audience perspectives and see the related lens or highlighted row without changing the capability. | Prototype; audience copy illustrative | `src/App.jsx:96`; `src/model.js:1-7,60-65` |
| FR-04 | The user can switch between Current and Future; the chosen maturity and planned visual treatment update in each relevant view. | Prototype | `src/App.jsx:97`; `src/Views.jsx:19-82` |
| FR-05 | The Matrix presents maturity 0–8+, audience rows, ownership encoding, a selected-capability explanation, and links to the other two views. | Prototype; layout relies on sample placement data | `src/Views.jsx:19-47`; [Matrix](screenshots/01-matrix.jpg) |
| FR-06 | The Journey presents current and target positions, stage descriptions, dependencies, audience value, and ownership transition for one capability. | Prototype; stage/audience prose partly hard-coded | `src/Views.jsx:50-61`; [Journey](screenshots/02-capability-journey.jpg) |
| FR-07 | The Map presents dependency edges, appliance and federated zones, the selected capability, and a handoff action. | Prototype; positions specific to sample nodes | `src/Views.jsx:64-82`; [Map](screenshots/03-domain-map.jpg) |
| FR-08 | The user can edit an existing capability through a form; a valid save updates all three views. | Prototype; no create/delete or undo | `src/App.jsx:21-41,104`; [Editor](screenshots/04-capability-editor.jpg) |
| FR-09 | Import and edit reject invalid capability documents without replacing the loaded list; error text identifies the fault. Browser and desktop MUST apply equivalent validation before production acceptance. | Partial: desktop sidecar checks relationships; browser bypasses Python | `src/model.js:76-100`; `sidecar/main.py:13-49`; `src/sidecarBridge.js:3-9` |
| FR-10 | The user can import and export a versioned YAML capability document. Export reflects the current in-memory values. | Prototype | `src/App.jsx:76-87`; `src/data/capabilities.yaml` |
| FR-11 | The Tauri app loads and saves the canonical YAML file in app data. Save failures are shown to the user. | Implemented in code; packaged runtime needs verification | `src-tauri/src/lib.rs:4-20`; `src/App.jsx:69-75,104` |
| FR-12 | The user can inspect proposed DITA audience, maturity, and ownership metadata for the selected capability, with an explicit draft warning. | Prototype, read-only | `src/App.jsx:44-52`; [Mapping panel](screenshots/05-dita-mapping.jpg) |
| FR-13 | The user can print the active view in landscape with navigation and controls omitted. | Prototype; page-fit validation pending | `src/App.jsx:98`; `src/styles.css:20` |
| FR-14 | The maturity model supports values beyond 8 without losing meaning or historical comparability. | Future; the current display clamps at the 8+ position | `src/Views.jsx:7,24-35`; decision PD-01 |
| FR-15 | The user can inspect changes by an approved time unit, such as milestone, release, or date, in addition to Current/Future state. | Future; data model undecided | decision PD-02 |
| FR-16 | Approved mappings can drive embedded content via Heretto Deploy API and manuals via PDF Gen, with a review step before publication. | Future; no live integration | `AGENTS.md:16`; `src/App.jsx:44-52`; CONTENT-01–06 in [integration spec](04-data-integration-specification.md) |

### Key acceptance paths

```gherkin
Scenario: Discuss a cross-boundary capability
  Given Contextual guidance is selected in the Matrix with Consultant and Future
  When I open Capability journey and then Federated domain map
  Then Contextual guidance remains selected
  And the map names Deployment metadata and Content service as dependencies
  And the handoff action is "Resolve ownership"

Scenario: Save a capability change
  Given Contextual guidance is selected and the editor is open
  When I change the target maturity from 5 to 6 and save a valid record
  Then the selected capability displays target maturity 6 in the Journey and Map
  And the YAML export contains target: 6 for contextual-guidance
```

The first scenario is covered by the current visual flow. The second must be rerun in both browser and packaged Tauri builds; browser edits require export to persist.

## 4. Data and external interfaces

- **YAML:** one `version: 1` document containing a nonempty `capabilities` list. Record fields and current validation are defined in [04 — Data and integration](04-data-integration-specification.md#2-canonical-yaml-document).
- **Python sidecar:** newline-delimited JSON with `validate`, `content-manifest`, and `report-summary` operations. The latter two return draft artifacts and are not wired to production delivery (`sidecar/main.py:52-92`).
- **Tauri:** `load_yaml`, `save_yaml`, and `process_data` commands. The shell bundles an architecture-specific sidecar executable (`src-tauri/src/lib.rs:4-64`; `src-tauri/tauri.conf.json`).
- **Heretto:** no current network connection. The proposed integration requires approved topic/map IDs, attributes, endpoint contract, access model, and PDF Gen scenario; the PDF in this folder does not supply validated values.
- **Print:** browser/Tauri webview print of the active screen. A report package is a separate future decision.

## 5. Quality requirements

| ID | Requirement | Current evidence and gap |
| --- | --- | --- |
| QR-01 Accessibility | All interactive nodes and controls MUST be keyboard operable, expose their name and state, and show visible focus. Modal panels MUST follow a dialog focus pattern. | Native buttons and form fields work; map-node keyboard behavior, select focus ring, and modal focus handling need work. See [visual spec PRE-01/02/06](03-visual-interaction-specification.md#prescribed-rule-register). |
| QR-02 Data integrity | Import/save MUST validate the same schema in browser and desktop, preserve the previous document on failure, and write atomically in desktop. | Browser bypasses Python validation; desktop write is direct, not atomic. |
| QR-03 Traceability | Each planning record and content mapping SHOULD expose source/version and approval status before it is used for publication. | Current records have `version: 1` only; no per-record provenance or approval workflow. |
| QR-04 Performance | The app SHOULD remain responsive with the project’s expected capability count; an explicit record count and interaction-time target must be set before acceptance. | Six sample records only; no scale benchmark. |
| QR-05 Offline behavior | Core planning, editing, import/export, and viewing SHOULD work without a Heretto connection. Content retrieval and PDF publication need explicit unavailable/fallback states. | Local prototype works without Heretto; future integration behavior undecided. |
| QR-06 Print quality | A printed view MUST show title, selected audience/state, capability scope, ownership legend, and uncropped information at an agreed paper size. | Landscape CSS exists; no packaged print QA or pagination requirement approved. |
| QR-07 Security | A Heretto integration MUST keep credentials outside YAML and printed output, restrict sidecar operations, and define endpoint authentication and authorization. | Tauri restricts operation names and payload size; Heretto auth design absent. |
| QR-08 Recoverability | The user SHOULD be able to identify unsaved browser changes and recover from a failed desktop save. | Browser message appears only inside editor; no persistent dirty indicator or backup. |

## 6. Constraints and exclusions

The desktop framework decision is Tauri 2 + React/Vite + Python sidecar. The current ownership enum has two values, and the current axis shows 0–8+. Real product terminology, maturity rubric, audience descriptions, sample capabilities, and DITA tags remain subject to owner review. The project does not yet define multi-user collaboration, authorization by audience, release scheduling, approved DITAVAL generation, a Heretto Deploy connection, or PDF Gen execution.

## 7. Acceptance and unresolved decisions

Acceptance requires: real YAML records and rubric; confirmed audience and ownership vocabulary; equivalent validation in browser and desktop; keyboard and modal fixes; packaged Tauri sidecar test; screenshot comparison and print check; approved `[PRE]` rules in the [visual spec](03-visual-interaction-specification.md); and a documented Heretto contract before any publication behavior is claimed. The open product decisions are PD-01–PD-06 in [01 — Product design context](01-product-design-context.md#open-product-decisions).

The current screenshots demonstrate the integrated direction. They do not certify production data, accessibility, packaged runtime, or content publication.
