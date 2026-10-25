# Visual and Interaction Specification

## 1. Header table

| Field | Value |
| --- | --- |
| Date | 2026-10-25 |
| Status | **Draft for review**. It records the current prototype and prescribed gaps; it has not passed the packaged-app acceptance gate. |
| Author | Codex, for review by the project owner and design/content leads |
| Source of truth | Implemented React view and interaction code `src/App.jsx:15-107`, `src/Views.jsx:7-82`; styling `src/styles.css:8-28`; five captures in `screenshots/` at 1494 × 1265 CSS px; selected concept images in `concepts/` |
| Implements into | `src/` in this repository, rendered in a Tauri 2 webview or a browser preview |
| Related documents | [Product design context](01-product-design-context.md), [Experience design](02-experience-design.md), [Data and integration](04-data-integration-specification.md) |

## 2. Purpose and use

[OBS] This specification covers the **integrated three-view iteration** shown in the five screenshots: Matrix, Capability Journey, Federated Domain Map, capability editor, and DITA mapping panel. The three standalone images in `concepts/` are prior visual directions, not independent apps to ship. The older AI-generated layouts inside `Capabilty-Matrix-App.pdf` are exploratory source material, not final design instructions.

[PRE] An implementing team should read the product and data specifications, review the screenshots at the reference viewport, confirm the `[PRE]` register in section 9, update the token source, implement components, and run the five checks in section 10. Where this specification and the prototype disagree after an owner has confirmed a `[PRE]` rule, this specification governs the next implementation; otherwise the observed prototype remains the visual baseline.

## 3. The framework

This document uses **Visual Specification Framework 1.0 (2026-10-03)**, bundled with the Visual Specification Writer skill. Its six layers remain separate:

| Layer | Concern | Vocabulary |
| --- | --- | --- |
| L1 | Obligation strength | BCP 14 `MUST`, `SHOULD`, `MAY` only with normative meaning |
| L2 | Visual values | DTCG `$type`, `$value`, and semantic aliases |
| L3 | Meaning and keyboard | WAI-ARIA 1.2 roles/states and APG patterns |
| L4 | Placement and size | CSS Grid, Flexbox, box model; `box-sizing:border-box` |
| L5 | Behavior over time | Named state, event, guard, action, invariant |
| L6 | Acceptance | Observable Given/When/Then scenarios |

`[OBS]` means directly observed in source or screenshot; `[INF]` means derived from an observation; `[PRE]` means prescribed where the design is silent and requires owner confirmation. Shipped copy appears in “double quotes”; illustrative runtime data appears as ‹angle-quoted data›. Measurements are CSS px at 1× and the 1494 × 1265 reference viewport. Components reference `{role.tokens}` in prose and `var(--role-tokens)` in CSS.

## 4. Design tokens

[OBS] The current stylesheet uses literal values and loads **Inter 400/500/600/700** and **Libre Baskerville 400/700** (`src/styles.css:1-9`). [PRE] The next implementation MUST move the roles below into a DTCG token source, generate CSS custom properties by replacing dots with hyphens, and use role tokens in components. The base colors and dimensions below reproduce observed key values; a full token migration must inventory remaining one-off values before claiming a literal-free implementation.

```json
{
  "color": {
    "base": {
      "canvas": {"$type":"color","$value":"#fbfaf7"},
      "white": {"$type":"color","$value":"#ffffff"},
      "ink": {"$type":"color","$value":"#142039"},
      "muted": {"$type":"color","$value":"#687287"},
      "rule": {"$type":"color","$value":"#e8e8e4"},
      "navBlue": {"$type":"color","$value":"#0758af"},
      "navTint": {"$type":"color","$value":"#e8f0f9"},
      "focusBlue": {"$type":"color","$value":"#90b9ff"},
      "teal": {"$type":"color","$value":"#3f9a9d"},
      "deepTeal": {"$type":"color","$value":"#0b5a61"},
      "gold": {"$type":"color","$value":"#dba95f"},
      "plannedTint": {"$type":"color","$value":"#eaf4f2"},
      "warningTint": {"$type":"color","$value":"#fff3ef"},
      "warningRule": {"$type":"color","$value":"#f5cfbf"},
      "warningInk": {"$type":"color","$value":"#bb4b31"},
      "warningAction": {"$type":"color","$value":"#d76143"},
      "primaryAction": {"$type":"color","$value":"#07585d"}
    },
    "role": {
      "page-background": {"$type":"color","$value":"{color.base.canvas}"},
      "surface": {"$type":"color","$value":"{color.base.white}"},
      "text-primary": {"$type":"color","$value":"{color.base.ink}"},
      "text-muted": {"$type":"color","$value":"{color.base.muted}"},
      "separator": {"$type":"color","$value":"{color.base.rule}"},
      "navigation-selection-fill": {"$type":"color","$value":"{color.base.navTint}"},
      "navigation-selection-text": {"$type":"color","$value":"{color.base.navBlue}"},
      "focus-outline": {"$type":"color","$value":"{color.base.focusBlue}"},
      "appliance-bar": {"$type":"color","$value":"{color.base.teal}"},
      "selected-bar": {"$type":"color","$value":"{color.base.deepTeal}"},
      "federated-bar": {"$type":"color","$value":"{color.base.gold}"},
      "planned-fill": {"$type":"color","$value":"{color.base.plannedTint}"},
      "handoff-fill": {"$type":"color","$value":"{color.base.warningTint}"},
      "handoff-border": {"$type":"color","$value":"{color.base.warningRule}"},
      "handoff-text": {"$type":"color","$value":"{color.base.warningInk}"},
      "handoff-action": {"$type":"color","$value":"{color.base.warningAction}"},
      "primary-button-fill": {"$type":"color","$value":"{color.base.primaryAction}"},
      "primary-button-text": {"$type":"color","$value":"{color.base.white}"}
    }
  },
  "dimension": {
    "base": {
      "sidebar": {"$type":"dimension","$value":"205px"},
      "mainInsetX": {"$type":"dimension","$value":"27px"},
      "cardRadius": {"$type":"dimension","$value":"7px"},
      "mapHeight": {"$type":"dimension","$value":"575px"},
      "editorWidth": {"$type":"dimension","$value":"460px"},
      "focusStroke": {"$type":"dimension","$value":"3px"}
    },
    "role": {
      "navigation-width": {"$type":"dimension","$value":"{dimension.base.sidebar}"},
      "content-inset-x": {"$type":"dimension","$value":"{dimension.base.mainInsetX}"},
      "surface-radius": {"$type":"dimension","$value":"{dimension.base.cardRadius}"},
      "domain-canvas-height": {"$type":"dimension","$value":"{dimension.base.mapHeight}"},
      "editor-max-width": {"$type":"dimension","$value":"{dimension.base.editorWidth}"},
      "focus-stroke": {"$type":"dimension","$value":"{dimension.base.focusStroke}"}
    }
  },
  "typography": {
    "role": {
      "body": {"$type":"typography","$value":{"fontFamily":"Inter","fontSize":"14px","fontWeight":400,"lineHeight":"21.7px","letterSpacing":"0px"}},
      "workspace-title": {"$type":"typography","$value":{"fontFamily":"Libre Baskerville","fontSize":"37px","fontWeight":400,"lineHeight":"45.14px","letterSpacing":"-1.295px"}},
      "sidebar-link": {"$type":"typography","$value":{"fontFamily":"Inter","fontSize":"14px","fontWeight":400,"lineHeight":"21.7px","letterSpacing":"0px"}},
      "section-title": {"$type":"typography","$value":{"fontFamily":"Libre Baskerville","fontSize":"21px","fontWeight":700,"lineHeight":"27.72px","letterSpacing":"-0.735px"}},
      "map-node-title": {"$type":"typography","$value":{"fontFamily":"Libre Baskerville","fontSize":"14px","fontWeight":700,"lineHeight":"19.6px","letterSpacing":"0px"}}
    }
  }
}
```

[INF] The semantic role aliases are derived from observed component use. Workspace and section title line heights and letter spacing are calculated from `src/styles.css:9,23`: `37 × 1.22 = 45.14`, `37 × -0.035 = -1.295`, and `21 × 1.32 = 27.72`. [PRE] The composite body and map-node line heights are proposed consolidation values; all typography values must be checked with computed styles at the reference viewport before token migration is accepted. [OBS] The current focus rule is a 3 px outline with 2 px offset (`src/styles.css:9`); the inner `<select>` overrides its own outline to 0 (`src/styles.css:11`), so a visible wrapper focus treatment is prescribed in PRE-02.

## 5. Window and global layout

[OBS] Reference viewport: **1494 × 1265** screenshots. Tauri's default window is **1440 × 1024**, minimum **900 × 700** (`src-tauri/tauri.conf.json`). The page CSS accepts a body minimum width of 320 px (`src/styles.css:9`), while the Tauri desktop window enforces the larger minimum. All stated sizes include borders under `box-sizing:border-box` (`src/styles.css:9`).

```text
app-shell — grid: 205px minmax(0,1fr)
├── sidebar — sticky; 100vh; internal navigation + working context
└── main — min-width:0; padding:19px 27px 28px
    ├── breadcrumb
    ├── app-header — intro + selected capability + perspective + state
    ├── view-label and actions
    └── current view — Matrix | Journey | Map
overlay — editor or content-mapping panel, attached to right edge
```

[OBS] At widths ≤1250 px, the sidebar becomes 184 px and header controls wrap; at ≤900 px, the sidebar becomes a horizontal top bar and the main view columns stack; at ≤600 px, narrow controls scroll horizontally (`src/styles.css:17-19`). The body can scroll vertically; the Matrix has an internal horizontal scroll container (`src/styles.css:12`). The map canvas is 575 px high under the later style override; the editor is at most 460 px wide and scrolls internally (`src/styles.css:16,25`). [PRE] The product owner and UX lead must confirm the intended minimum usable browser viewport and overflow policy for very long capability names (PRE-03).

## 6. Shared components

Each record uses the fixed field order: Role, Box, Type, Content, States, Behaviour, Keyboard, Accept, Source. “Unavailable” states are proposed where the prototype has no corresponding treatment.

### CMP-01 Primary navigation

- **Role.** [OBS] `<nav aria-label="Primary navigation">` with native `button` controls. [PRE] Active button should expose `aria-current="page"` or an equivalent current-view announcement.
- **Box.** [OBS] Sticky 205 px sidebar with grid of links; 184 px at ≤1250 px; horizontal strip at ≤900 px (`src/styles.css:10,17-19`).
- **Type.** [OBS] `{typography.role.sidebar-link}`, `{color.role.text-primary}`. Active uses `{color.role.navigation-selection-fill}` and `{color.role.navigation-selection-text}`.
- **Content.** [OBS] “Matrix”, “Capability journey”, “Domain map”; working context uses ‹capability name›, ‹audience›, and ‹state›.
- **States.** [OBS] Default transparent, hover tinted, active blue tinted. [OBS] Focus-visible receives the global outline. [PRE] Disabled-with-reason, loading, error, and overflow need explicit treatments if navigation can become unavailable; currently all three buttons are always enabled.
- **Behaviour.** `view=matrix --click "Capability journey" / view:=journey--> view=journey`; analogous transitions exist for all three destinations. Selection, audience, and state do not change.
- **Keyboard.** [OBS] Native buttons support Tab, Enter, and Space. [PRE] Current-view announcement must not alter native button activation.
- **Accept.** `Given Contextual guidance and Consultant are selected; When I activate "Domain map"; Then the main heading is "Federated domain map" and the selected capability remains Contextual guidance.`
- **Source.** [OBS] `src/App.jsx:15-19,88-101`; `screenshots/01-matrix.jpg`, `screenshots/03-domain-map.jpg`.

### CMP-02 Shared context controls

- **Role.** [OBS] Two labeled native `select` controls and a labeled `group` of two native buttons. [PRE] Current/Future buttons should expose `aria-pressed` or use a radio-group pattern, with its full keyboard contract.
- **Box.** [OBS] Header controls display as flex; selection boxes are 38 px high; capability selector has 192 px width (`src/styles.css:11`).
- **Type.** [OBS] `{typography.role.body}`, `{color.role.text-primary}`; active state button has a strong dark fill (`src/styles.css:11`).
- **Content.** [OBS] “Selected capability”, “Perspective”, “State”, “Current”, “Future”; option labels come from YAML and the audience model.
- **States.** [OBS] Selected option/value and active button update immediately. [PRE] Focus-visible must surround the visible select wrapper (PRE-02). [PRE] Disabled needs a visible reason when no capability exists; loading, empty, and error states require PRE-04.
- **Behaviour.** `state=future --click "Current" / state:=current--> state=current`; `selectedId=a --select b / selectedId:=b--> selectedId=b`; `perspective=x --select y / perspective:=y--> perspective=y`.
- **Keyboard.** [OBS] Native selects and buttons use platform keyboard behavior. [PRE] Focus and selected state must be separately perceivable.
- **Accept.** `Given Contextual guidance is selected; When I choose "Leadership" in Perspective; Then the header value is "Leadership" and the Matrix highlights the Leadership row.`
- **Source.** [OBS] `src/App.jsx:55-67,94-97`; `src/styles.css:11`; `screenshots/01-matrix.jpg`.

### CMP-03 Action toolbar

- **Role.** [OBS] Native buttons and a hidden file input for import.
- **Box.** [OBS] Flex row aligned to the right of the view label, wrapping at narrower widths (`src/styles.css:11,17-19,24`).
- **Type.** [OBS] `{typography.role.body}`; “Edit capability” has an outlined treatment, while text actions have no persistent fill.
- **Content.** [OBS] “Content mapping”, “Import YAML”, “Export YAML”, “Print report”, “Edit capability”.
- **States.** [OBS] Hover adds a light fill; focus-visible uses the global outline. [PRE] Import should show loading, success, and error adjacent to the action rather than only transient toast; unavailable actions need visible reasons (PRE-04). Long labels may horizontally scroll at ≤600 px.
- **Behaviour.** `mapping=closed --click "Content mapping" / mapping:=open--> mapping=open`; `editing=closed --click "Edit capability" / editing:=open--> editing=open`; Import opens file picker; Export downloads YAML; Print invokes print dialog.
- **Keyboard.** [OBS] Native button behavior. The hidden import input is reached through its button.
- **Accept.** `Given the Matrix is visible; When I activate "Content mapping"; Then a panel headed "DITA mapping" is visible for the selected capability.`
- **Source.** [OBS] `src/App.jsx:76-98`; `screenshots/05-dita-mapping.jpg`.

### CMP-04 Capability bar and matrix selection

- **Role.** [OBS] Each capability bar is a native `button` with a title identifying the capability.
- **Box.** [OBS] 26 px high positioned bar inside a row track; the Matrix grid begins with a 165 px audience column and at least 590 px of phase tracks (`src/styles.css:12`).
- **Type.** [OBS] Appliance uses `{color.role.appliance-bar}`, federated uses `{color.role.federated-bar}`, selected uses `{color.role.selected-bar}`; label uses Libre Baskerville 12 px after override (`src/styles.css:12,23`).
- **Content.** [OBS] ‹capability name›. The hatched end indicates planned reach and must remain distinguishable without color.
- **States.** [OBS] Default ownership fill, selected outline and darker fill, focus-visible global outline; overflow ellipsizes the name. [PRE] Hover and disabled-with-visible-reason need a defined accessible explanation when interaction is restricted. Empty row needs explicit copy (PRE-05).
- **Behaviour.** `selectedId=a --click capability b / selectedId:=b--> selectedId=b`.
- **Keyboard.** [OBS] Native button activation with Enter/Space. [PRE] Keyboard focus order through crowded rows should remain in source order and announce current/target maturity.
- **Accept.** `Given the Matrix is open; When I activate the Contextual guidance bar; Then the selected-capability panel heading is "Contextual guidance".`
- **Source.** [OBS] `src/Views.jsx:19-47`; `src/styles.css:12,23`; `screenshots/01-matrix.jpg`.

### CMP-05 Domain-map capability node

- **Role.** [OBS] React Flow nodes are clickable containers in the current accessibility tree. [PRE] Each selectable node MUST expose a keyboard-operable `button` or equivalent role, name, and selected state (PRE-06).
- **Box.** [OBS] 230 px wide, at least 102 px high after the final override; `ReactFlow` fits nodes within a 575 px canvas (`src/styles.css:25`; `src/Views.jsx:79`).
- **Type.** [OBS] Appliance/federated left border and icon, selected blue outline, dashed future-planned border; title uses `{typography.role.map-node-title}`.
- **Content.** [OBS] ‹current maturity› / ‹target maturity›, ‹name›, ‹summary›.
- **States.** [OBS] Default, selected, and planned states. [PRE] Hover, focus-visible, disabled-with-reason, loading, empty, error, and long-name overflow must be specified after keyboard and large-graph design is approved.
- **Behaviour.** `selectedId=a --activate node b / selectedId:=b--> selectedId=b`; dependencies remain edges and the selected capability drives the explanation below the map.
- **Keyboard.** [PRE] Tab reaches each node in a predictable sequence; Enter/Space selects it; the accessible name includes capability and maturity (PRE-06).
- **Accept.** `@pre Given the Domain map is visible; When I tab to a node and press Enter; Then the selected-capability name below the map equals that node's name.`
- **Source.** [OBS] `src/Views.jsx:64-82`; `screenshots/03-domain-map.jpg`.

### CMP-06 Right-side editor and mapping panel

- **Role.** [OBS] A form or labeled section in a fixed backdrop. [PRE] Both panels MUST implement a modal `dialog` pattern with an accessible title and focus containment (PRE-01).
- **Box.** [OBS] Right aligned panel, width `min(460px,100vw)`, full viewport height, independently scrolling (`src/styles.css:16`).
- **Type.** [OBS] White surface, serif heading, Inter form labels, global focus outline; validation error is red and `role="alert"` (`src/App.jsx:31-52`).
- **Content.** [OBS] Editor fields: ‹name›, ‹summary›, ‹current›, ‹target›, ‹owner›, ‹futureOwner›, ‹decision›, dependency checkboxes. Mapping panel shows ‹audience›, ‹maturity›, ‹ownership› and a draft warning.
- **States.** [OBS] Closed/open; editor error on empty name or target below current; save success toast; mapping read-only. [PRE] Loading/validating, unsaved-changes confirmation, disabled-with-reason, empty mapping, long-text overflow, and recoverable error states require PRE-01 and PRE-04.
- **Behaviour.** `editing=closed --click "Edit capability" / editing:=open--> editing=open`; `editing=open --save [valid] / persist and close--> editing=closed`; `editing=open --save [invalid] / show error--> editing=open`; close/backdrop returns to closed. Mapping uses analogous open/close transitions.
- **Keyboard.** [PRE] On open, focus moves to heading or first field; Tab stays in the dialog; Escape closes only after unsaved-change policy; closing restores focus to the opener (PRE-01).
- **Accept.** `Given the editor contains target maturity 5; When I set target maturity 2 and activate "Save changes"; Then the editor remains open and displays "Target maturity should be at least current maturity."` [OBS]. `@pre Given I opened the editor from "Resolve ownership"; When I press Escape; Then focus returns to "Resolve ownership" after cancellation is resolved.`
- **Source.** [OBS] `src/App.jsx:21-52,104-105`; `screenshots/04-capability-editor.jpg`, `screenshots/05-dita-mapping.jpg`.

## 7. Global interaction model

| State variable | Type and initial value | Readers | Source |
| --- | --- | --- | --- |
| `capabilities` | array; parsed bundled YAML | all views, selectors, editor, export | [OBS] `src/App.jsx:13,55` |
| `selectedId` | string; `contextual-guidance` | all views, both panels, sidebar | [OBS] `src/App.jsx:57,65` |
| `perspective` | audience ID; `consultant` | all views, sidebar | [OBS] `src/App.jsx:58` |
| `state` | `current` or `future`; `future` | maturity markers, map edges and labels | [OBS] `src/App.jsx:59` |
| `view` | `matrix`, `journey`, or `map`; `matrix` | main region and navigation | [OBS] `src/App.jsx:60` |
| `editing`, `mapping` | booleans; both false | overlay panels | [OBS] `src/App.jsx:61-62` |
| `toast` | string; empty | transient status region | [OBS] `src/App.jsx:63,68,106` |

[OBS] Global navigation statechart: `view=x --select view y / view:=y--> view=y`. Its invariant is `selectedId`, `perspective`, `state`, and `capabilities` remain unchanged. Shared selection statechart: `selectedId=a --select capability b [b exists] / selectedId:=b--> selectedId=b`. State comparison: `state=current --select Future / state:=future--> state=future`, and the reverse. Audience switching changes the lens without changing the capability or state (`src/App.jsx:90-101`).

[OBS] Editor lifecycle: `closed --open--> open`; `open --save [local and sidecar validation succeeds] / replace one record, persist in Tauri, close, announce--> closed`; `open --save [validation fails] / show error or toast--> open`. Mapping lifecycle: `closed --open--> open --close--> closed`. The import path parses a selected file, normalizes it, calls validation, saves in Tauri, replaces the list, and selects the first capability (`src/App.jsx:82-87`). Browser preview skips Python validation (`src/sidecarBridge.js:3-9`). [PRE] Loading and unsaved-change states must be made explicit before production (PRE-04).

[OBS] The view-change animation is `reveal .18s ease-out` (`src/styles.css:16`). [PRE] Honor reduced-motion preference and disable nonessential movement under `prefers-reduced-motion:reduce` (PRE-07). [OBS] Form fields use native keyboard controls; the map-node keyboard gap is documented in CMP-05. No global shortcut scheme is defined.

## 8. Screens

### Screen 1 — Matrix

[OBS] The Matrix composes CMP-01–04. At the reference viewport, its content uses `grid-template-columns:minmax(0,1fr) 295px` with 18 px gap; the insight panel has a left separator (`src/styles.css:12-13`). The chart itself uses `165px minmax(590px,1fr)`, nine equal phase tracks, a 51 px header, and 108 px audience rows (`src/styles.css:12`). Reference: `screenshots/01-matrix.jpg`.

```gherkin
Scenario: Select a capability from the Matrix
  Given the Matrix shows a bar named Contextual guidance
  When I activate that bar
  Then the selected-capability heading is "Contextual guidance"

Scenario: Compare current and future maturity
  Given Contextual guidance has current maturity 3 and target maturity 5
  When I activate "Current"
  Then the insight line contains "Maturity phase 3"
  When I activate "Future"
  Then the insight line contains "Maturity phase 5"
```

### Screen 2 — Capability journey

[OBS] The Journey composes CMP-01–03 and the shared context controls. It has nine equal maturity tracks, a two-part owner ribbon, a main content area and a 250 px side panel (`src/styles.css:14`; `src/Views.jsx:50-61`). Reference: `screenshots/02-capability-journey.jpg`. The stage and audience prose in this screenshot is illustrative runtime sample copy from `src/Views.jsx:8-19`.

```gherkin
Scenario: Trace a dependency to the map
  Given the Journey for Contextual guidance lists Content service as a dependency
  When I activate the Content service dependency row
  Then the main heading is "Federated domain map"
  And the selected capability remains Contextual guidance
```

### Screen 3 — Federated domain map

[OBS] The Map composes CMP-01–03 and CMP-05. Its current implementation is a full-width 575 px canvas with appliance and federated background zones, followed by a three-column explanation at the reference viewport (`src/styles.css:15,25`; `src/Views.jsx:73-82`). Reference: `screenshots/03-domain-map.jpg`. [PRE] Large-graph layout, crossing reduction, and keyboard traversal are unresolved (PRE-06).

```gherkin
Scenario: Open an ownership decision from the map
  Given Contextual guidance is selected in the Domain map
  When I activate "Resolve ownership"
  Then the panel heading is "Edit capability"
  And the current owner field is "Appliance"
  And the future owner field is "Federated"
```

### Screen 4 — Capability editor and DITA mapping

[OBS] Both screens compose CMP-06 over the active view. The editor is shown in `screenshots/04-capability-editor.jpg` and the mapping panel in `screenshots/05-dita-mapping.jpg`. The editor currently validates a nonempty name and target ≥ current before invoking the sidecar (`src/App.jsx:25-30`). The mapping panel displays a warning that its attribute names are hypotheses (`src/App.jsx:44-52`).

```gherkin
Scenario: Reject an empty name
  Given the capability editor is open
  When I clear Name and activate "Save changes"
  Then the editor remains open and displays "Enter a capability name."

Scenario: Show draft content mapping
  Given Contextual guidance is selected
  When I activate "Content mapping"
  Then the panel heading is "DITA mapping"
  And it displays "client, consultant" under Audience
  And it displays the warning that mappings need validation
```

## 9. Known differences between design sources

| # | Topic | Source A | Source B | Rule followed and reason |
| --- | --- | --- | --- | --- |
| 1 | Separate compositions versus one shell | `concepts/02-capability-journey.png`, `concepts/03-domain-map.png` have standalone headers | `src/App.jsx:88-101` and screenshots share sidebar/header | [OBS] Integrated shell wins because the user selected all three and requested navigation among them. |
| 2 | DITA taxonomy | `Capabilty-Matrix-App.pdf` proposes specific attribute values | `src/App.jsx:48-51` warns they are hypotheses | [OBS] Draft-only mapping wins until the content architect validates the stock. |
| 3 | Focus visibility for selects | Global focus rule in `src/styles.css:9` | Select override `outline:0` in `src/styles.css:11` | [PRE] Visible wrapper focus wins; the current conflict is a defect to resolve in PRE-02. |
| 4 | Maturity beyond 8 | Product brief calls 8+ extensible | `src/Views.jsx:7,24-35,46` has nine display positions and clamps values | [PRE] Require an approved extension model before claiming >8 visual support. |
| 5 | Journey audience coverage | Five audiences in `src/model.js:1-7` | Four lanes in `src/Views.jsx:59` | [PRE] Decide the wider-domain lane and content before acceptance. |

### Prescribed-rule register

| ID | Rule | Owner | Status |
| --- | --- | --- | --- |
| PRE-01 | Modal role, focus containment, Escape/unsaved policy, and focus restoration | UX lead + developer lead | Proposed |
| PRE-02 | Visible focus on selector wrapper; announce state toggle selection | UX lead + accessibility reviewer | Proposed |
| PRE-03 | Minimum browser viewport, horizontal overflow, and longest-name behavior | UX lead | Proposed |
| PRE-04 | Loading, empty, validation-error, save-error, and disabled-with-visible-reason treatments | Product owner + UX lead | Proposed |
| PRE-05 | Empty Matrix row and no-capability document behavior | Product owner | Proposed |
| PRE-06 | Keyboard-operable map nodes and large-graph layout | UX lead + developer lead | Proposed |
| PRE-07 | Reduced-motion behavior | UX lead + accessibility reviewer | Proposed |
| PRE-08 | Reviewed token source replaces CSS literals without visual drift | UX lead + developer lead | Proposed |

No `[PRE]` item is approved by its presence in this document.

## 10. Verification procedure

1. **Token test.** [PRE] Parse the JSON in section 4; resolve every `{…}` alias; assert generated custom properties equal token values; fail on component color/font/size literals not exempted in a documented migration list. **Current status:** not run; `src/styles.css` still uses literals.
2. **Computed-style tests.** [PRE] At 1494 × 1265, inspect `getComputedStyle` for every listed component property in default, hover, active, and focus states. Record exact differences. **Current status:** screenshots inspected; no systematic computed-style suite run.
3. **Side-by-side screenshots.** [PRE] Capture all five states from a **packaged Tauri application** at the reference size and compare to `screenshots/` and the selected `concepts/` references. Pixel differences locate issues; a deviation record gives the disposition. **Current status:** supplied captures are from the Vite development server, not a packaged app.
4. **Scenarios.** [PRE] Run every Gherkin scenario in sections 6–8, plus one `@pre` scenario for every prescribed rule after approval. Record pass/fail against observable strings, roles, tokens, and dimensions. **Current status:** navigation and panel entry were observed interactively; full scenario coverage remains open.
5. **Owner confirmation.** [PRE] Record Confirmed or Overridden for PRE-01 through PRE-08, including replacement text for overrides. **Current status:** all remain Proposed.

Deviation record shape: `screen | reference | observed value | required value | disposition (Fixed or Deferred with reason and tracking ID)`. A screenshot alone does not close a deviation. **Readiness:** draft, pending `[PRE]` decisions and token migration. **Acceptance:** pending packaged-app captures, scenario run, and deviation record.

## 11. References

- Visual Specification Framework 1.0 (2026-10-03), bundled with the Visual Specification Writer skill.
- [BCP 14](https://www.rfc-editor.org/info/bcp14); [DTCG format](https://www.designtokens.org/TR/2025.10/format/); [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/); [ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/); [CSS Grid](https://www.w3.org/TR/css-grid-1/); [CSS Flexbox](https://www.w3.org/TR/css-flexbox-1/); [CSS Box Model](https://www.w3.org/TR/css-box-3/); [SCXML](https://www.w3.org/TR/scxml/); [Gherkin](https://cucumber.io/docs/gherkin/reference/).
- Repository source: `src/App.jsx`, `src/Views.jsx`, `src/model.js`, `src/styles.css`, `src/data/capabilities.yaml`, `src-tauri/tauri.conf.json`.
- Implemented screenshots: `screenshots/01-matrix.jpg` through `screenshots/05-dita-mapping.jpg`; earlier concepts: `concepts/01-integrated-shell.png` through `concepts/03-domain-map.png`.
- Related: [Product design context](01-product-design-context.md), [Experience design](02-experience-design.md), [Data and integration](04-data-integration-specification.md).
