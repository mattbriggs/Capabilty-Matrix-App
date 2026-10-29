# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product decisions

- The user chose all three concept views: Matrix, Capability Journey, and Federated Domain Map. They must stay navigable as one product with shared selected capability, audience perspective, and current/future state.
- Use React for the desktop UI, Tauri 2 for the native shell, and a Python sidecar for model validation and future content/report processing.
- YAML is the canonical capability document. The bundled sample is `src/data/capabilities.yaml`; the Tauri shell stores edits as `capabilities.yaml` in its app data directory. The browser preview can import and export YAML but does not auto-save edits.
- The DITA metadata panel records proposed mappings only. Do not present those mappings as a validated CCMS configuration. Embedded content via the CCMS Deploy API and PDF manuals via CCMS PDF Gen are future integration targets.
- Maturity 8+ is an extensible wider-domain horizon. Audience perspectives include client, consultant, product team, leadership, and wider domain.
- Use "CCMS" (not "Heretto") in user-facing text for the content management system.
- Owner names (default "Appliance" and "Federated") and audience perspectives are user-editable in Settings and stored under `settings` in the YAML. Owner ids stay `appliance`/`federated`.
- State is a timeline, not a current/future toggle. A **Current** period is the reference point and a **Focus** period is the point compared against it (past or future). The timeline granularity is month, quarter, biannual or year; dates are stored as ISO strings so milestones survive granularity changes. `current` maturity is anchored at `settings.timeline.asOf`, `target` at the last period, with optional per-capability `milestones` between.
- Maturity levels (name and description) and dependencies are editable per capability; the target is set from a level in the journey view or in the editor.
- Print report uses the Tauri `print_page` command in the desktop app (`window.print()` is a no-op in WKWebView) and falls back to `window.print()` in the browser.
- Add a separate data entry and validation workspace alongside the three concept views, plus a project/file manager for YAML-backed project CRUD, YAML/CSV import and export, and JSON Schema export.
- The data table must allow independently selected, different X/Y dimensions (capability, maturity, audience, domain and time segment), with object-specific editing trays. Journey and definition information must be configurable.
- Preserve the Matrix and Capability journey experience. Preserve the Domain map's colored organic blobs while making layout and region sizes dynamic; support remembered manual card positions, zoom, multiple named saved views with CRUD, and organic layout rebuilds.
- The proposed implementation requirements, data-contract choices and acceptance gates for this update are documented in `_design/_notes/2026-10-26-Tech-Note-Implementation-Update1.md`; distinguish those proposals from the user decisions above.
- Validation uses layered Pydantic contracts in `sidecar/capmatrix/` (document, issues and transport messages) as the single structural source. The browser validates against the JSON Schema generated from them (`npm run schema`) plus twin semantic rules; shared fixtures in `tests/fixtures/` must keep browser and Python results identical, with test coverage for each layer.
- Open implementation questions for update 1 are held for a single review pass in `_design/_notes/2026-10-26-Tech-Note-Open-Quetions1.md`.
