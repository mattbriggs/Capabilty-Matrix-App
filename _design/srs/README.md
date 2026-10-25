# Capability and Ownership Matrix — design and requirements

**Status:** Draft design handoff, 2026-10-25. The Markdown documents describe the current prototype and identify decisions needed before production implementation. The bundled YAML records are illustrative.

| Document | Purpose |
| --- | --- |
| [01 — Product design context](01-product-design-context.md) | Problem, stakeholders, dimensions, scope, and success criteria |
| [02 — Experience design](02-experience-design.md) | Navigation, workflows, three linked views, and screen captures |
| [03 — Visual and interaction specification](03-visual-interaction-specification.md) | Measurable layout, components, states, keyboard behavior, and acceptance scenarios |
| [04 — Data and integration specification](04-data-integration-specification.md) | YAML contract, validation, Tauri/Python boundary, DITA/Heretto mapping, and reports |
| [05 — Software requirements specification](05-software-requirements-specification.md) | Traceable functional and quality requirements with acceptance criteria and delivery status |

The [original 18-page PDF](Capabilty-Matrix-App.pdf) preserves the earlier exploratory conversation. Its generated examples are **not** a validated taxonomy or a product requirement. Where it differs from the running prototype, the Markdown documents state the difference and mark the decision still needed.

## Visual evidence

The five screenshots below were captured from the running React prototype at a 1494 × 1265 viewport, with **Contextual guidance**, **Consultant**, and **Future** selected. The concept images are earlier design references; the screenshots show the implemented state.

| Screen | Capture | Earlier concept |
| --- | --- | --- |
| Matrix | [01-matrix.jpg](screenshots/01-matrix.jpg) | [Integrated shell](concepts/01-integrated-shell.png) |
| Capability journey | [02-capability-journey.jpg](screenshots/02-capability-journey.jpg) | [Journey](concepts/02-capability-journey.png) |
| Federated domain map | [03-domain-map.jpg](screenshots/03-domain-map.jpg) | [Map](concepts/03-domain-map.png) |
| Capability editor | [04-capability-editor.jpg](screenshots/04-capability-editor.jpg) | — |
| DITA mapping panel | [05-dita-mapping.jpg](screenshots/05-dita-mapping.jpg) | — |

## Evidence and status terms

- **Observed** means present in the repository or captured screen. Code references use repository-relative `file:line` positions at the time of this handoff.
- **Proposed** means a product or design decision for the next iteration. It is not implemented or approved merely because it appears here.
- **Illustrative** means sample capability content, audience prose, or DITA metadata used to demonstrate the interaction.

The repository's current target is Tauri 2 + React/Vite + Python sidecar. Heretto Deploy API content retrieval and PDF Gen are future integration targets; the current app shows a draft mapping only.
