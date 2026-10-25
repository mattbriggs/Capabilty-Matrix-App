# Capability and Ownership Matrix

[![GitHub repository](https://img.shields.io/badge/GitHub-Capability--Matrix--App-181717?logo=github)](https://github.com/mattbriggs/Capabilty-Matrix-App)
[![GitHub stars](https://img.shields.io/github/stars/mattbriggs/Capabilty-Matrix-App?style=flat&logo=github)](https://github.com/mattbriggs/Capabilty-Matrix-App/stargazers)
[![Open issues](https://img.shields.io/github/issues/mattbriggs/Capabilty-Matrix-App?style=flat)](https://github.com/mattbriggs/Capabilty-Matrix-App/issues)
[![Last commit](https://img.shields.io/github/last-commit/mattbriggs/Capabilty-Matrix-App?style=flat)](https://github.com/mattbriggs/Capabilty-Matrix-App/commits)

A planning workspace for exploring capability maturity, ownership, dependencies, and future change across an appliance and its federated domain.

The React app provides three linked views:

- **Matrix** — compare capabilities across audience perspectives and maturity levels.
- **Capability journey** — review one capability's current and target states, dependencies, and ownership.
- **Federated domain map** — explore relationships and ownership across capabilities.

The selected capability, audience, and current/future state are shared across views. The project uses React and Vite for the UI, Tauri 2 for the desktop app, and a Python sidecar for validation and draft content/report manifests.

## Get started

### Web preview

Requires Node.js and npm.

```bash
npm install
npm run dev
```

The browser preview keeps edits in memory. Export YAML to save your work.

### Desktop app

Requires Node.js, Rust, and Python 3.10 or later.

```bash
npm install
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run sidecar:build
npm run tauri dev
```

The desktop app loads and saves `capabilities.yaml` in its application data directory. Build the sidecar on each target operating system and architecture before packaging.

### Documentation site

The documentation source is in [`site/`](site/index.md) and the built HTML is written to `docs/`.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/mkdocs serve
```

To build the static site:

```bash
.venv/bin/mkdocs build
```

## Using the app

Use **Import YAML** to load a capability file, **Edit capability** to change the selected record, and **Export YAML** to save a portable copy. In the desktop app, importing and editing also save to the app's data directory. The browser preview does not auto-save.

For YAML structure, project setup, and detailed workflows, start with the [user guide](site/guide.md) and [YAML reference](site/yaml-format.md). The documentation is built with MkDocs Material and Mermaid diagrams.

## Project layout

| Path | Purpose |
| --- | --- |
| `src/` | React app, views, styling, YAML model, and bundled sample |
| `sidecar/main.py` | Python JSON-line validation and draft manifest processor |
| `src-tauri/` | Tauri desktop shell and native integration |
| `pyproject.toml` | Python project metadata and build/documentation tool groups |
| `requirements.txt` | Python build and documentation dependencies for `.venv` |
| `mkdocs.yml` | MkDocs Material configuration; source `site/`, output `docs/` |
| `site/` | Markdown documentation source |

The bundled [`src/data/capabilities.yaml`](src/data/capabilities.yaml) is illustrative sample data, not a statement of actual project ownership or capability maturity.

## Scope notes

YAML is the canonical capability document. The content-mapping panel records proposed DITA metadata only; its values are not a validated Heretto configuration and do not publish content. Heretto Deploy API delivery and PDF Gen manuals remain future integration targets.
