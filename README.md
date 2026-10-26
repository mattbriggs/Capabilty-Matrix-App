# Capability and Ownership Matrix

[![GitHub repository](https://img.shields.io/badge/GitHub-Capability--Matrix--App-181717?logo=github)](https://github.com/mattbriggs/Capabilty-Matrix-App)
[![GitHub stars](https://img.shields.io/github/stars/mattbriggs/Capabilty-Matrix-App?style=flat&logo=github)](https://github.com/mattbriggs/Capabilty-Matrix-App/stargazers)
[![Open issues](https://img.shields.io/github/issues/mattbriggs/Capabilty-Matrix-App?style=flat)](https://github.com/mattbriggs/Capabilty-Matrix-App/issues)
[![Last commit](https://img.shields.io/github/last-commit/mattbriggs/Capabilty-Matrix-App?style=flat)](https://github.com/mattbriggs/Capabilty-Matrix-App/commits)

## What this app is for

The Capability and Ownership Matrix is a planning workspace for teams deciding **what capabilities a product or service needs, how mature those capabilities are today, and where they should belong in the future**.

It helps make product and domain boundaries visible. Teams can compare current and planned maturity, see dependencies, and discuss whether a capability should remain part of an appliance or move to a shared, federated service. Audience perspectives help frame those decisions for clients, consultants, product teams, leadership, and the wider domain.

The app is a planning and visualization tool, not a source of authoritative organizational facts. The bundled data is an illustrative example; replace it with your own project capability document.

## What you can do

- Explore capabilities in three linked views:
  - **Matrix:** compare capability maturity across audience perspectives.
  - **Capability journey:** examine one capability's current and target maturity, dependencies, and ownership.
  - **Federated domain map:** explore capability relationships and appliance/federated boundaries.
- Keep the selected capability, audience perspective, and current/future state in context while navigating between views.
- Import a project YAML file, edit capability records, and export the updated YAML.
- Print the active view for discussion or planning.
- Review proposed DITA audience, maturity, and ownership metadata.

YAML is the canonical capability document. Browser edits stay in memory until exported. The desktop app also saves imported and edited YAML in its application data directory. The DITA panel is a planning aid only; it does not validate Heretto mappings or publish content.

## Get started

### Requirements

- Node.js and npm for the web app.
- Python 3.10 or later and `venv` for the sidecar build and documentation site.
- Rust and the platform prerequisites required by [Tauri 2](https://v2.tauri.app/start/prerequisites/) to run or package the desktop app.

### Install

From the repository root:

```bash
npm install
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

On Windows, use `.venv\Scripts\python.exe` instead of `.venv/bin/python`.

### Run the web preview

```bash
npm run dev
```

Open the local URL printed by Vite. The preview provides the app's core views and YAML workflows. It does not save changes automatically, so export your YAML before closing or refreshing.

### Run the desktop app during development

Build the Python sidecar, then start the Tauri desktop shell:

```bash
npm run sidecar:build
npm run tauri dev
```

The sidecar build uses the repository's `.venv` and creates a native executable under `src-tauri/binaries/`. Build it on each target operating system and architecture before packaging.

### Build and launch the macOS app

Run these commands from the repository root on a Mac. The sidecar must be built for the Mac's architecture (Apple Silicon or Intel) before packaging:

```bash
npm run sidecar:build
npm run tauri build
```

Tauri builds the app bundle in `src-tauri/target/release/bundle/macos/` and, with the configured `all` bundle targets, a disk image in `src-tauri/target/release/bundle/dmg/`. Launch the built app from Terminal with:

```bash
open "src-tauri/target/release/bundle/macos/Capability and Ownership Matrix.app"
```

You can also open the `.app` in Finder or install it by opening the generated `.dmg` and dragging the app into Applications. The desktop app loads and saves `capabilities.yaml` in its Tauri application data directory.

For a development build that opens the desktop window while Vite is running, use `npm run tauri dev` instead. The release `.app` is a local build; distributing it to other users may require Apple code signing and notarization.

## Use your project data

1. **Prepare a YAML file.** Start with [`src/data/capabilities.yaml`](src/data/capabilities.yaml) and save a project-specific copy. Give each capability a unique ID, name, current and target maturity, current and future owner, and any dependencies.
2. **Import it.** In the app, choose **Import YAML** and select the `.yaml` or `.yml` file. A successful import replaces the active capability set.
3. **Explore and edit.** Select a capability, choose an audience perspective, and switch between current and future state. Use **Edit capability** to update a record; the views stay linked to the same data.
4. **Export your work.** Choose **Export YAML** to download a portable copy. Browser changes are not persisted unless exported. In the desktop app, a successful import or edit also updates the app's saved YAML.

The desktop Python sidecar checks capability relationships such as dependency references and owner values. The browser preview performs basic record and maturity checks but does not run the sidecar, so use the documented YAML values and ensure all dependency IDs exist in the file.

See the [user guide](site/guide.md) for additional workflow details and the [YAML format reference](site/yaml-format.md) for fields and validation rules.

## Build and preview the documentation

The documentation uses MkDocs Material with Mermaid diagrams. Markdown source files live in [`site/`](site/); the generated static HTML goes to `docs/`.

```bash
.venv/bin/mkdocs serve
```

To build the static documentation:

```bash
.venv/bin/mkdocs build
```

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | React app, shared views, YAML model, and bundled example |
| `sidecar/main.py` | Python validation and draft content/report manifest processor |
| `src-tauri/` | Tauri desktop shell, persistence, and sidecar integration |
| `pyproject.toml` | Python project metadata and optional tool groups |
| `requirements.txt` | Python sidecar build and documentation dependencies |
| `mkdocs.yml` | MkDocs configuration; source is `site/`, output is `docs/` |
| `site/` | Markdown documentation |

## Current scope

The app records capability planning data and proposed DITA metadata. It does not publish to the CCMS, generate production DITAVAL files, or create PDF manuals. CCMS deployment (Deploy API) and PDF Gen are future integration targets; any content mappings should be validated against the eventual DITA content model before use.
