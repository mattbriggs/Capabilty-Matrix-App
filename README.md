# Capability and Ownership Matrix

[![GitHub repository](https://img.shields.io/badge/GitHub-Capability--Matrix--App-181717?logo=github)](https://github.com/mattbriggs/Capabilty-Matrix-App)
[![GitHub stars](https://img.shields.io/github/stars/mattbriggs/Capabilty-Matrix-App?style=flat&logo=github)](https://github.com/mattbriggs/Capabilty-Matrix-App/stargazers)
[![Open issues](https://img.shields.io/github/issues/mattbriggs/Capabilty-Matrix-App?style=flat)](https://github.com/mattbriggs/Capabilty-Matrix-App/issues)
[![Last commit](https://img.shields.io/github/last-commit/mattbriggs/Capabilty-Matrix-App?style=flat)](https://github.com/mattbriggs/Capabilty-Matrix-App/commits)

The Capability and Ownership Matrix is a strategic planning workspace for defining capabilities, assessing their maturity, mapping dependencies, and making product-boundary and ownership decisions. Analysts curate the capability data in YAML, then use three linked views to test and communicate a plan across client, consultant, product-team, leadership, and wider-domain perspectives.

The tool supports planning; it is not a system of record for operational facts. The bundled example is illustrative and must be replaced with project-validated data. The Content mapping panel captures proposed DITA metadata only. CCMS deployment and PDF manual generation are future integration targets, not current features.

## Features

- **Matrix:** compare maturity and capability reach across audience perspectives.
- **Capability journey:** inspect maturity levels, timeline milestones, ownership, and dependencies for one capability.
- **Federated domain map:** trace dependency relationships and discuss the product/federated responsibility boundary.
- **Shared planning context:** the selected capability and audience remain selected across views. A **Current** reference period and a **Focus** comparison period can be set to any period on the timeline.
- **Projects:** create, open, search, rename, delete (to a restorable trash) and import or export YAML-backed projects. Same-ID imports offer open, replace or copy; version 1 files are migrated with a preview and the original is kept.
- **Data workspace:** create, edit and delete capabilities, maturity levels, audiences, domains and time segments in editing trays; a relationship table with independently chosen X/Y dimensions; a persistent validation panel that opens the offending field; a YAML source editor; and undo.
- **Configurable journey:** capability definitions, stage outcomes and exit criteria, and audience guidance by stage, with section labels and visibility set per project.
- **Scalable domain map:** organic regions sized from their cards, owner anchors, pan/zoom/fit, pinned positions remembered per owner/domain context, layout rebuild with preview and undo, and named saved views.
- **One validated contract:** Pydantic models define the document; the browser validates against the JSON Schema generated from them plus twin cross-record rules, and the desktop sidecar re-validates every save. Shared fixtures hold both to identical results.
- **Portable files:** YAML is the complete project; a versioned CSV format round-trips losslessly; the JSON Schema is exportable.
- **Print:** print the active view for a planning discussion.

See the [full analyst user guide](site/guide.md) for the end-to-end process, screen-by-screen instructions, and planning workflow. Use the [YAML format reference](site/yaml-format.md) to create or check an import file.

## Run the application

### Requirements

- Node.js and npm for the web preview.
- Python 3.10 or later for the sidecar build and documentation commands.
- Rust and the platform prerequisites required by [Tauri 2](https://v2.tauri.app/start/prerequisites/) for the desktop app.

### Install dependencies

From the repository root, install the JavaScript dependencies and create the Python environment used by the sidecar and docs:

```bash
npm install
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

On Windows, use `.venv\Scripts\python.exe` in place of `.venv/bin/python`.

### Start the browser preview

Start Vite and open the local URL it reports:

```bash
npm run dev
```

The browser preview starts with the bundled sample as a session project. Projects live only in the tab: export YAML or CSV before refreshing or closing it.

### Start the desktop app

Build the Python sidecar for the current operating system and architecture, then launch the Tauri development app:

```bash
npm run sidecar:build
npm run tauri dev
```

The desktop app stores each project at `<app-data>/projects/<project-id>/capabilities.yaml` with atomic, revision-checked writes; deleted projects move to `<app-data>/trash/`. On first launch it migrates an earlier single `capabilities.yaml` once and leaves the original in place. Every change is validated by the Python sidecar before it is saved. Rebuild the sidecar (`npm run sidecar:build`) after changing `sidecar/`, and on each target platform before packaging.

### Package the macOS app

On a Mac, build the sidecar and package the application:

```bash
npm run sidecar:build
npm run tauri build
```

The app bundle is created under `src-tauri/target/release/bundle/macos/`. With the configured `all` bundle targets, the disk image is under `src-tauri/target/release/bundle/dmg/`. This is a local build; distribution may require Apple code signing and notarization.

From the repository root in Bash, launch the built macOS app with:

```bash
open "src-tauri/target/release/bundle/macos/Capability and Ownership Matrix.app"
```

## Test

```bash
npm run test:js            # browser domain, storage, map and service tests (node:test)
npm run test:js:coverage   # the same with line/branch coverage thresholds
npm run test:py            # Pydantic contract, validation, migration and sidecar tests (pytest, ≥95% branch coverage)
npm run test:rust          # desktop project storage: atomic writes, conflicts, trash/restore
npm run build && npm run test:sites
```

After changing `sidecar/capmatrix/contracts/document.py`, run `npm run schema` to regenerate `src/data/schema/capability-project.schema.json`; a test fails if they drift. Validation fixtures shared by both languages live in `tests/fixtures/`.

## Build and preview the documentation

Markdown documentation is authored in [`site/`](site/), with MkDocs configuration in [`mkdocs.yml`](mkdocs.yml). The static site is generated into `docs/`:

```bash
.venv/bin/mkdocs serve
.venv/bin/mkdocs build
```

The guide uses Mermaid diagrams to explain the analyst workflow, YAML model, and screen layouts.

## Project layout

| Path | Purpose |
| --- | --- |
| [`src/views/`](src/views/), [`src/features/`](src/features/) | Matrix and Journey views; Projects, Data workspace and Domain map features |
| [`src/domain/`](src/domain/) | Pure document logic: validation, migration, timeline, CSV, relation projection, operations |
| [`src/storage/`](src/storage/), [`src/state/`](src/state/) | Repository adapters, serialized saves and the project service |
| [`src/data/`](src/data/) | Bundled sample project and the generated JSON Schema |
| [`sidecar/capmatrix/`](sidecar/capmatrix/) | Pydantic contracts (document, issues, messages), validation layers, migration, sidecar service and transport |
| [`src-tauri/`](src-tauri/) | Tauri desktop shell, managed project storage, printing, and sidecar integration |
| [`tests/`](tests/) | JS, Python and Sites tests, plus shared fixtures |
| [`site/`](site/) | Markdown source for the user guide and data reference |
| [`mkdocs.yml`](mkdocs.yml) | MkDocs site configuration |

## Current scope and limitations

YAML is the canonical project document. Saving rewrites the file in canonical form, so YAML comments and formatting are not preserved. The browser preview keeps projects only for the session. Arbitrary third-party CSV layouts are not imported; only the app's typed-row CSV format round-trips. Desktop packaging and native interaction have not been re-verified in a packaged build for this update.

The tool does not retrieve source data automatically, publish to a CCMS, validate a production DITA configuration, generate DITAVAL files, or create PDF manuals. CCMS deployment and PDF generation remain future integration work. Validate proposed content mappings with the content team before using them in a publishing workflow.
