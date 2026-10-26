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
- **Editable planning data:** edit capability descriptions, ownership, handoff period, maturity levels, milestones, dependencies, audience perspectives, owner labels, and timeline settings.
- **Portable YAML:** import a project document and export the active data. The desktop app also saves successful imports and edits to its app data directory; the browser preview does not auto-save.
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

The browser preview loads the bundled sample on startup. Import your own `.yaml` or `.yml` file to work with project data. Changes are held in memory until you export the YAML, so export before refreshing or closing the tab.

### Start the desktop app

Build the Python sidecar for the current operating system and architecture, then launch the Tauri development app:

```bash
npm run sidecar:build
npm run tauri dev
```

The desktop app loads a saved `capabilities.yaml` from its Tauri application data directory when one exists; otherwise, it starts from the bundled sample. Successful imports and edits are validated by the sidecar and saved to that file. Build the sidecar separately on each target platform and architecture before packaging.

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
| [`src/`](src/) | React app, linked views, YAML model, and bundled example |
| [`src/data/capabilities.yaml`](src/data/capabilities.yaml) | Illustrative, versioned YAML document |
| [`sidecar/main.py`](sidecar/main.py) | Desktop validation and draft content/report manifest processor |
| [`src-tauri/`](src-tauri/) | Tauri desktop shell, persistence, printing, and sidecar integration |
| [`site/`](site/) | Markdown source for the user guide and data reference |
| [`mkdocs.yml`](mkdocs.yml) | MkDocs site configuration |

## Current scope and limitations

YAML is the canonical capability document. The app provides a guided editor for existing capability records, but it does not create or delete capability records in the GUI; prepare those records in YAML before import. Browser import normalizes basic record values but does not run the desktop sidecar's complete relationship validation. The importer also normalizes missing or unrecognized owner values to `appliance`, so supply `appliance` or `federated` explicitly rather than relying on the validator to reject a typo.

The tool does not retrieve source data automatically, publish to a CCMS, validate a production DITA configuration, generate DITAVAL files, or create PDF manuals. CCMS deployment and PDF generation remain future integration work. Validate proposed content mappings with the content team before using them in a publishing workflow.
