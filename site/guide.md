# User guide

## Start the application

For the browser preview, install the JavaScript dependencies and start Vite:

```bash
npm install
npm run dev
```

Browser edits are held in memory; export the YAML to keep them.

For the Tauri desktop app, create the project virtual environment and build the Python sidecar:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm install
npm run sidecar:build
npm run tauri dev
```

The sidecar build uses this `.venv`. It creates a platform-specific executable in `src-tauri/binaries/`; build it on each target operating system and architecture before packaging.

## Configure a project

The current app has no separate project-settings screen. Configure a project by preparing its capability YAML file, then importing it in the app. Start from the bundled example at [`src/data/capabilities.yaml`](https://github.com/mattbriggs/Capabilty-Matrix-App/blob/main/src/data/capabilities.yaml), save a project-specific copy, and edit its `capabilities` records. See the [YAML format reference](yaml-format.md) for required fields and validation rules.

Each capability should have a unique, stable `id`; dependencies refer to those IDs. Record the current and future owner, maturity values, and audience-specific DITA planning metadata as applicable. The sample's values are placeholders, not project defaults or validated content mappings.

## Import YAML

1. Select **Import YAML** in the app.
2. Choose a `.yaml` or `.yml` file with a nonempty `capabilities` list.
3. The app parses and validates the data, then replaces the active capability set if validation succeeds.
4. The first imported capability becomes selected. Choose the capability, perspective, and current/future state using the controls.

If parsing or basic record checks fail, the app reports an error and retains the current capability set. The desktop sidecar also checks owner values and dependency references. The browser preview does not run the sidecar, so check those fields yourself before importing there.

In the desktop app, a successful import also saves the YAML in the Tauri application data directory as `capabilities.yaml`. In the browser preview, the import only updates the current session.

## Edit and export

Choose **Edit capability** to update the selected record. Saving validates the full set, including dependencies, and updates the record in all three views. Desktop edits are saved to the app data file; browser edits remain in memory.

Choose **Export YAML** to download the current capability set as `capability-ownership.yaml`. Export before closing the browser preview if you want to keep your changes. Export is also useful for creating a portable project backup or sharing it with another user.

## Navigate and print

- Choose **Matrix**, **Capability journey**, or **Domain map** in the sidebar.
- Choose a capability and audience perspective in the header.
- Switch between **Current** and **Future** to compare the current record with its target maturity and future ownership.
- Select **Print report** to print the active view.
- Select **Content mapping** to inspect proposed DITA metadata. This is planning information only, not a validated CCMS configuration.

## Build the documentation

The Markdown source lives in `site/`. With the project virtual environment active, preview changes locally or write the static HTML to `docs/`:

```bash
.venv/bin/mkdocs serve
.venv/bin/mkdocs build
```

Mermaid diagrams are rendered with Mermaid.js in the Material theme.
