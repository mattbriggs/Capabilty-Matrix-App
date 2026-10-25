# Product design context

**Status:** Draft · **Date:** 2026-10-25 · **Source:** user brief in this project conversation, `AGENTS.md:13-17`, `README.md`, and the exploratory PDF in this folder.

## Product purpose

The Capability and Ownership Matrix is an interactive strategic planning tool for an appliance that operates inside a larger federated technology environment. It helps people see how a capability matures, what another audience needs from it, what it depends on, and where responsibility passes from the appliance to another service. Its primary outcome is a shared, reviewable scope and ownership decision rather than a decorative maturity score.

The design addresses bounded rationality by preserving the same selected capability while people switch audience perspective and move among three representations. A consultant can inspect delivery dependencies, a product team can see its data contract, and leadership can inspect scope and handoff risk without losing the common object under discussion.

## Stakeholders and jobs

| Audience | Planning question | Current prototype treatment |
| --- | --- | --- |
| Client | What outcome and help will be available in my environment? | Matrix row and client lens; sample needs in `src/model.js:1-6,60-65` |
| Consultant | What must be configured, explained, and handed over? | Default lens; journey audience lane and dependencies |
| Product team | What belongs in the appliance, and what contract must it expose? | Product team lens; metadata and ownership decisions |
| Leadership | Where are scope, cost, and responsibility risks? | Leadership lens and handoff alert |
| Wider domain | How does a local capability connect to the evolving ecosystem? | Wider-domain row and 8+ horizon |

These five audiences are the current prototype set (`src/model.js:1-7`). Their labels and descriptive copy need review with actual project stakeholders before release.

## Dimensions and their status

| Dimension | Intent | Prototype status |
| --- | --- | --- |
| Maturity | Track an evolving capability from 0 through 8+, with room beyond 8 | Numeric `current` and `target` in YAML; visible axis has nine positions, 0–8+; display clamps values above 8 (`src/Views.jsx:7,24-35`) |
| Audience perspective | Reveal needs and dependencies through a selected lens | Five selectable audiences; selection carries across views (`src/App.jsx:58,95-101`) |
| Capability | Make one capability the stable planning object | Selectable YAML-backed records; cross-view selection (`src/App.jsx:55-67,99-101`) |
| State | Compare current and future | Global Current/Future switch (`src/App.jsx:59,97`) |
| Ownership | Show appliance versus federated responsibility and handoff | Current and future owner fields; color, ribbon, and map alert (`src/model.js:91-98`; `src/Views.jsx`) |
| Dependencies | Explain upstream services and cross-boundary reliance | Directed dependency IDs in YAML and map edges (`src/data/capabilities.yaml`; `src/Views.jsx:76-82`) |
| Time | Show milestones and roadmap horizon | **Proposed, not modeled**. Current/Future is a state switch, not a date or time axis. |
| DITA content | Trace capabilities to audience-specific content and outputs | Draft `dita` object and read-only mapping panel; no publication (`src/App.jsx:44-52`) |

## Core decisions already made

1. The **Matrix**, **Capability Journey**, and **Federated Domain Map** are complementary views in one navigable application. Selection, perspective, and state carry between them (`AGENTS.md:13`).
2. YAML is the canonical capability record. The desktop shell persists it in the Tauri application data directory; the browser preview uses import/export (`AGENTS.md:15`; `src/App.jsx:69-105`).
3. The UI target is React/Vite inside Tauri 2, with a Python sidecar for validation and future content/report processing (`AGENTS.md:14`).
4. The DITA panel records intent. Heretto Deploy API for embedded content and PDF Gen for manuals remain future integration targets (`AGENTS.md:16`; `src/App.jsx:44-52`).
5. Maturity 8+ represents an evolving wider-domain horizon, not a terminal certification (`AGENTS.md:17`).

## Experience principles

- **Keep context visible.** The header and sidebar repeat the selected capability, audience, and state so a user can tell what a view means before reading its detail.
- **Show relationships, not just ranks.** A maturity value has meaning alongside dependencies, audience needs, and owner transition.
- **Make handoffs discussable.** The domain map exposes the responsibility boundary and a direct path to edit the selected capability's ownership decision.
- **Distinguish fact from planning intent.** Current and future values, illustrative sample data, and unvalidated DITA metadata are labeled separately.
- **Support a meeting artifact.** The active view has a print layout; a production report definition still needs an agreed content and page contract.

## Scope and success criteria

The next usable planning release should let a stakeholder import the real YAML document, choose an audience, inspect a capability in all three views, understand at least one dependency and ownership handoff, edit the record through a form, and export or print the result. A change to selected capability, perspective, or state should remain in effect when switching views. The user should be able to distinguish current state from a planned target and tell when content mappings are still draft.

Production Heretto publication, automatic DITAVAL generation, endpoint configuration, PDF Gen execution, a dated roadmap, and multi-user collaboration are outside the demonstrated prototype. They are candidate requirements in [04 — Data and integration specification](04-data-integration-specification.md), pending project data and owner decisions.

## Open product decisions

| ID | Decision needed | Why it matters |
| --- | --- | --- |
| PD-01 | Define the real maturity rubric, including how values above 8 are named and displayed | The current labels and 8+ rendering are illustrative |
| PD-02 | Decide whether the time axis is dates, releases, milestones, or scenarios | It determines the data model and comparison controls |
| PD-03 | Approve audience names and whether each lens hides, dims, or only explains other audiences' records | This changes how bounded rationality is addressed |
| PD-04 | Define ownership states beyond appliance/federated, if shared, pending, or unassigned are needed | It changes validation and handoff warnings |
| PD-05 | Replace sample capabilities with project records and an agreed dependency semantics | The current six records are examples |
| PD-06 | Review DITA attributes, content boundaries, Deploy API target, and PDF Gen scenario with the content team | The exploratory PDF's proposed taxonomy is not a validated Heretto design |

![Current Matrix screen showing audience rows and the selected capability](screenshots/01-matrix.jpg)
