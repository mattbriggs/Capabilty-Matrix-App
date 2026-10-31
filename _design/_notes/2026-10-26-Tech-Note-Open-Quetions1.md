# Implementation update 1: open issues and questions

**Prepared:** 2026-10-29, after implementing `2026-10-26-Tech-Note-Implementation-Update1.md`.
**Purpose:** Every decision I made without asking, every gap I know of, and every place I departed from the tech note, in one list for a single review pass.

Each item says what is implemented now (**Now**), what you need to decide (**Question**), and what I recommend (**Rec**). Items marked **⚑** need an answer, or a check, before a desktop release. You can accept the rest as they are.

## Verification baseline

| Check | Result |
| --- | --- |
| `npm run test:js` | 121/121 pass. Coverage of the pure layers (domain, storage, service, map logic): 99.8% lines, 93.6% branches. |
| `npm run test:py` | 161/161 pass. Branch coverage of the `capmatrix` package: 98.6% (the gate is 95%). |
| `npm run test:rust` | 5/5 pass: atomic writes, revision conflicts, trash/restore, path-safe IDs. |
| Browser/Python parity | 61 shared fixture cases (including every failure observed in the tech-note review) give identical issue keys in both languages. Golden files cover defaults and the v1→v2 migration. |
| `npm run build` then `npm run test:sites` | Clean build. 4/4 pass. `dist/client/index.html`, `dist/server/index.js` and `dist/.openai/hosting.json` are all present. |
| Packaged sidecar binary | Rebuilt with Pydantic and smoke-tested from the command line (`validate`, `schema`). |
| Browser UI | Driven headlessly in Chrome across all five screens. Covered: map drag, save, rebuild and zoom; dirty-work guard; axes and swap; create and undo; invalid draft; deletion impact; v1 migration import; same-ID import; empty project; trash and restore; issue-to-field focus; keyboard grid navigation; exports; fix-in-source import. No page errors. |
| **Not run** | `npm run tauri dev` or `tauri build`, native print, native file save, and A7 timings on a recorded reference machine (see D1–D4). |

## A. Data contract decisions

**A1. Unknown fields are warnings, not errors.**
Now: Fields the contract does not define are kept and reported as `field.unsupported` warnings, so they never block an import.
Question: Should any unknown field ever block?
Rec: Keep them as warnings. This follows "report unsupported fields rather than dropping them."

**A2. A file with no `version` but a `capabilities` list is treated as version 1.**
Now: It is offered for migration. A bare list of capabilities is treated the same way. Any other file without a version gets an error.
Question: Is this compatibility path acceptable, or must every file declare a version?
Rec: Keep it, because version 1 accepted bare lists.

**A3. Level IDs come from level names during migration.**
Now: For example, "Managed" becomes `managed`, with `-2` added if a name repeats. Because most capabilities use the default level names, their level IDs match across capabilities.
Question: Do you want opaque IDs (such as `lvl-ab12`) instead?
Rec: Keep readable IDs. Default guidance (A4) depends on IDs matching across capabilities.

**A4. ⚑ Default guidance is keyed by audience and level ID. The sample's prose was placed by my judgment.**
Now: `presentation.defaultGuidance` applies to any capability that has a level with that ID. The four statements per audience that used to be hard-coded in the journey were moved into the sample as default guidance at `initial`, `managed`, `optimized` and `extended`. The old prose had four columns and no level semantics, so that mapping is my guess.
Question: Is that mapping right? Should default guidance be keyed by rank instead of level ID?
Rec: Keep keying by level ID, and review or rewrite the sample prose.

**A5. Collisions between milestones and anchor dates are exact-date only.**
Now: A milestone on exactly the `asOf` date or the final segment start is an error. A milestone later in the same period is allowed.
Question: Should "same period as an anchor" also be an error?
Rec: Keep exact-date only. Dates are stored independently of granularity.

**A6. The timeline start day is ignored. `asOf` does not need to fall on a segment start.**
Now: Segments always begin on the 1st of the month. `start: 2026-10-15` behaves like `2026-10-01` without a warning. The `asOf` date only has to fall inside the timeline.
Question: Should a start date that is not the 1st, or an `asOf` that is not a segment start, raise a warning?
Rec: Add a warning for both. It is a small change in both validators plus fixtures.

**A7. A handoff date outside the timeline is a warning.**
Now: It is the warning `handoff.range`, not an error.
Rec: Keep it as a warning.

**A8. ID formats.**
Now: Project IDs allow letters, digits, `-` and `_` (up to 64 characters). Other IDs must start with a letter or digit and may also contain `.` (up to 80 characters). Uppercase is allowed. Generated IDs are lowercase slugs.
Question: Should IDs be restricted to lowercase?
Rec: Leave them as they are.

**A9. CSV has two record types beyond the tech-note list, and `parent_id` is always empty.**
Now: `extensions` holds the root `extensions`. `document` holds unknown top-level fields, which keeps the round trip lossless. Levels, milestones and guidance stay nested in the capability payload, so `parent_id` is unused.
Question: Accept the extra types? Should levels become separate child rows with `parent_id`?
Rec: Accept both as they are. Child rows add complexity without improving the round trip.

**A10. CSV is implemented in the browser layer only.**
Now: Both runtimes parse CSV in JavaScript. On desktop, the rebuilt document still passes the Python sidecar before it is saved.
Question: Do you want a Python CSV implementation for future report processing?
Rec: Not now.

**A11. Integers in JSON versus YAML.**
Now: Python's strict integers reject `1.0`, while JavaScript cannot tell `1.0` from `1`. This never diverges in practice, because the sidecar receives `JSON.stringify` output, which writes `1`.
Rec: No action. This is recorded for completeness.

## B. Behaviour and UX decisions

**B1. ⚑ The desktop app saves every applied change automatically.**
Now: There is no Save button. Each applied change is validated and written, and the header shows Saving…, then Saved, Save failed (Retry / Save a copy) or Changed on disk (Reload / Save mine as a copy).
Question: Would you rather have explicit Save with an unsaved document state?
Rec: Keep autosave. The old app saved on every edit, and drafts already give you an "unsaved" stage.

**B2. ⚑ Browser projects are lost when you refresh.**
Now: Projects live in memory only, as the tech note says. The header shows "Session only · not exported", and the browser warns on unload.
Question: Should session projects survive a refresh (`sessionStorage` or IndexedDB)?
Rec: Use `sessionStorage`. It is cheap and removes the most likely loss of work in the preview.

**B3. Data-table axes and filters are saved into the project YAML.**
Now: They live in `presentation.dataTable`, as specified. Each change writes the document and updates `updatedAt`, but does not add an undo entry.
Question: Should table layout be a per-user preference instead of project data?
Rec: Keep it in the project, as the tech note says.

**B4. The Maturity stage axis needs one or more capabilities in the filter, not exactly one.**
Now: With one capability, the headings show that capability's level names and open its level tray. With several, the headings show ranks only and cannot be edited.
Question: Should the axis require exactly one capability?
Rec: Keep one or more. Comparing ranks across a few capabilities is useful.

**B5. The Matrix bars now come from data.**
Now: Rows come from `audienceIds`, plus an Unassigned row. A bar starts at the maturity on the Current date and ends at the higher of the target and the Focus maturity, plus one column. This replaces the sample-specific offsets. Every member capability is shown; the old two-bar fallback limit is gone.
Question: Is this the bar meaning you want?
Rec: Confirm it visually with real data.

**B6. Panning and zooming do not mark a map view dirty.**
Now: Positions, filters and layout changes mark the view dirty. The viewport is captured when you choose Save.
Question: Should viewport changes also mark the view dirty?
Rec: No. Otherwise every pan would trigger the Save/Discard prompt.

**B7. Dependencies that cross owners are drawn in coral.**
Now: This replaces the hard-coded `deployment-metadata → content-service` "handoff" edge. Membership links (owner anchor to domain region) are dotted grey. The two regions of a domain that spans both owners are joined by a dashed "same domain" link.
Rec: Confirm the visual language.

**B8. Region shape and colour.**
Now: Each owner gets a large zone blob in the original lavender or beige. Each domain region inside it uses the domain's colour. Outlines are convex hulls around the padded cards, pushed slightly outward and smoothed, so they always contain their cards. Tests check this for 0, 1, 50 and 250 cards. In dense layouts, owner zones can overlap one another.
Rec: Look at a real project before tuning further.

**B9. The layout engine is deterministic and incremental.**
Now: New cards, and cards in a new owner/domain context after a Focus change, are placed near their group. Nothing that already has a position moves. Rebuild previews a new seed, keeps pins unless you choose Reset, and supports Apply, Cancel and Undo. Generated cards never overlap; 250 cards take about 0.3 s in Node. Some cards can sit slightly across the soft centre line between owners.
Rec: Accept it.

**B10. Undo history clears when you switch projects.**
Now: Undo holds up to 30 data operations per open project. The map has its own Undo layout.
Rec: Accept it.

**B11. Click targets on the map.**
Now: Clicking an owner anchor opens Settings, where the owner labels are edited. Clicking a domain label opens that domain's tray.
Rec: Accept it.

**B12. Time segments are uniform and generated.**
Now: You add or remove segments by changing the timeline count or start in the Timeline tray, which shows an impact preview. A checkbox lets you explicitly remove milestones that would fall outside the new range. You cannot insert a segment in the middle, and segments cannot have irregular lengths.
Question: Are irregular segments needed?
Rec: No, given "generated from timeline granularity/start/count."

**B13. Focus trapping and popover behaviour.**
Now: Trays and dialogs set `aria-modal`, close on Escape with dirty protection, and restore focus. Tab can still move focus out of an open tray. The filter popovers (`<details>`) do not close on Escape or on an outside click.
Rec: Add a focus trap and popover dismissal before an accessibility sign-off.

**B14. The validation panel shows the committed project's issues.**
Now: A committed project never has errors, so the panel normally shows warnings. A draft's errors appear inline in its tray. An invalid file appears in the import preview or the repair view.
Rec: Accept it.

## C. Desktop, native and persistence

**C1. ⚑ Exports in the desktop app may not download.**
Now: Export YAML, CSV, JSON Schema and the table report create a browser `<a download>` link, the same approach the old Export YAML used. WKWebView in Tauri has no download handler, so this probably does nothing on desktop. I have not verified it natively.
Rec: Add `tauri-plugin-dialog` with a Save dialog and a Rust write command, and use them in the desktop adapter.

**C2. ⚑ Sidecar latency.**
Now: The PyInstaller one-file sidecar starts a new process for every validation, which happens on every applied change. One-file start-up is usually 0.3–1 s, and I have not measured it on desktop.
Rec: Measure it. If it is slow, switch to a long-lived sidecar process using the same contracts (and an `--onedir` build).

**C3. ⚑ What happens when the sidecar response is incompatible.**
Now: If the sidecar returns something without the issue contract (for example, an outdated binary), the app shows a warning and relies on browser validation instead of blocking every save. Browser validation shares the same rules and fixtures.
Question: Should an incompatible sidecar block saves, since Python is the desktop validation boundary?
Rec: Block release builds, keep the fallback in development builds, and add a version handshake.

**C4. The project index is not fully rebuilt from the files.**
Now: `projects-index.json` caches names and descriptions, and every save updates it. If it is lost, projects are still listed by ID, and their names return the next time each one is saved.
Rec: Add a Rust-side rebuild that reads `project.name` from each file. It is small.

**C5. External changes are detected only when saving.**
Now: Every write compares revisions. There is no file watcher, and reopening a project loads the current file.
Rec: Accept it for this release.

**C6. Legacy migration runs once and only when there are no managed projects.**
Now: A localStorage flag records that it has run. An invalid legacy file is left untouched and you are told to import it.
Rec: Accept it.

**C7. ⚑ The original v1 file has no "Download original" action.**
Now: The original bytes are written as `original-v1.yaml` in the project folder (desktop) or kept in the session (browser), but the UI has no action to download them, which "the original import remains downloadable" calls for.
Rec: Add a "Download original" action in Projects, on the migrated project's row.

**C8. Trash IDs.**
Now: Trash IDs are `<id>--<milliseconds>`. Tests found a collision when the same project was deleted twice within one millisecond; both the session adapter and Rust now step past an existing ID. Restoring is refused while a project with that ID exists.
Rec: Accept it. The trash cannot be purged yet. Should it be?

**C9. `.openai/hosting.json` is untracked.**
Now: The file exists locally (`{"d1": null, "r2": null}`) and the build copies it, but git does not track it. The tech note's failed build came from it being missing.
Question: Commit it?
Rec: Yes, so a clean checkout can build for Sites.

## D. Not verified, or known gaps

**D1. ⚑ No native desktop run.** I did not run `tauri dev` or `tauri build`, native print, native persistence end to end, or the packaged sidecar inside the app. Rust storage has unit tests, and the sidecar binary was smoke-tested on its own.

**D2. ⚑ A7 is measured in Node only.** Validation of 250 capabilities × 20 audiences × 60 periods takes under 1 s. Relation-table projection is p95 under 200 ms over 20 measured runs. Organic layout of 250 cards takes about 0.3 s. These cover the logic only. Rendering time in a browser, and timings on a recorded reference machine, still need measuring.

**D3. Partial virtualization.** The relationship table windows its rows and columns and has sticky headers. The record lists (for example 250 capabilities) and the domain map's 250 cards are fully rendered. React Flow's `onlyRenderVisibleElements` is not enabled.

**D4. No screen-reader pass.** Issues carry text severity labels and do not rely on colour. The toast and status messages use live regions. The grid has ARIA roles and arrow-key navigation. I did not run a screen reader.

**D5. Large bundle.** The main JavaScript chunk is about 820 kB (245 kB gzipped). Code splitting is not done.

**D6. YAML formatting is not kept.** Saving rewrites a hand-edited file in canonical, compact form, which drops comments, as the tech note allows.

**D7. Sample data.** The domains, colours and the single sample definition on Contextual guidance are mine and are illustrative, labelled "Sample definition" in the data. Please review them before demos.

## E. Departures from the tech note's implementation sequence

- **E1. Layout of the code.** Trays live in `src/features/data/trays/` with an entity registry (`TrayHost`); the tech note proposed `src/components/`. Only shared pieces are in `src/components/`.
- **E2. Schema source.** The JSON Schema is generated from the Pydantic models (`npm run schema`), and a test fails if it drifts. Hand-writing it would have created two sources of structure.
- **E3. Structural validation in the browser.** It uses a small schema-subset validator rather than Ajv, so its error codes and paths match Pydantic exactly. A test fails if the schema ever uses a keyword it does not support.
- **E4. Validation errors are routed differently.** Validation runs before anything is applied, so an invalid document never becomes the working copy. Drafts are held per tray, and invalid files go to a source-editor repair view. There is no "invalid working copy" state.
- **E5. The old flat Settings timeline.** The timeline editor moved into a Timeline tray with an impact preview. Settings now holds owner names, perspectives (opened in the audience tray) and journey section configuration.
