# YAML format

YAML is the canonical capability document. The app accepts a top-level object containing a nonempty `capabilities` array. It also supports a bare array of capability records. Exported files use the versioned object shape:

```yaml
version: 1
capabilities:
  - id: contextual-guidance
    name: Contextual guidance
    current: 3
    target: 5
    owner: appliance
    futureOwner: federated
    summary: Guidance at the point of need.
    decision: Define the ownership handoff.
    dependencies:
      - content-service
    dita:
      audience:
        - client
        - consultant
      maturity: phase-3
      ownership: appliance-native
```

See the full [bundled sample](https://github.com/mattbriggs/Capabilty-Matrix-App/blob/main/src/data/capabilities.yaml) for additional records and dependencies.

## Capability fields

| Field | Required | Meaning |
| --- | --- | --- |
| `id` | Yes | Unique, nonempty identifier. Other capabilities use it for dependencies. Keep it stable when renaming a capability. |
| `name` | Yes | Nonempty display name. |
| `current` | Yes | Nonnegative numeric current maturity. |
| `target` | Yes | Nonnegative numeric target maturity. It must be at least `current`. |
| `owner` | Yes | Current owner: `appliance` or `federated`. |
| `futureOwner` | Yes | Planned owner: `appliance` or `federated`. |
| `summary` | No | Short description for the capability. |
| `decision` | No | Scope, ownership, or planning decision. |
| `dependencies` | No | List of other capability IDs. Use `[]` when there are none. |
| `dita` | No | Proposed content metadata; fields are planning values only. |

Maturity is nonnegative and can extend beyond 8 for a wider-domain horizon. The current validator does not impose a maximum. Audience identifiers used by the app are `client`, `consultant`, `product-team`, `leadership`, and `wider-domain`.

The optional `dita` object can contain:

| Field | Example | Purpose |
| --- | --- | --- |
| `audience` | `[client, consultant]` | Intended audience identifiers. |
| `maturity` | `phase-3` | Proposed maturity tag. |
| `ownership` | `appliance-native` | Proposed ownership tag. |

## Validation rules

- The capability list must contain at least one record.
- Each record must be an object with a unique, nonempty `id` and a nonempty `name`.
- `current` and `target` must be numeric and nonnegative; `target` must not be lower than `current`.
- `owner` and `futureOwner` must each be `appliance` or `federated`.
- `dependencies` must be a list of IDs that exist in the same file. A capability cannot depend on itself.

The app checks basic record structure and numeric fields. In the desktop app, the Python sidecar additionally checks owner values and dependency references. The browser preview does not run the sidecar: it does not verify dependency IDs, and unrecognized or missing owner values default to `appliance`. For consistent results, provide every field shown in the example and use the values in this reference rather than relying on importer defaults.
