# Workspace identity and UI QA

The visual direction is a landscape drafting desk: warm paper, dark ink, clay accents, a custom growth-ring/coordinate mark, fine rules, and restrained corners. System fonts avoid a network font dependency. The mark is also the favicon.

The header keeps view modes, history, summary, and season visible. Project actions move into one disclosure; imagery/boundary and camera/grid controls move into Layers and Views. The library shows All plants or the four-slot Plant kit rather than duplicating favorite tiles. The inspector prioritizes placement distances and current dimensions; explanations, botanical notes, and site accuracy remain available through disclosures. Mobile puts the landscape first.

## Verification

- All 95 tests across 20 files pass. Lint and TypeScript/production build pass. The existing large-bundle warning remains.
- New keyboard regression coverage checks Escape cancellation of an armed species and selection without changing the design; Walk keeps its separate Escape behavior.
- Browser checks at the normal 1280 × 720 desktop viewport and 390 × 844 phone viewport. A 900 px breakpoint layout check found no horizontal document overflow. Temporary viewport overrides were reset.
- Checked Layers imagery switching, Views/reset camera, Plan grid on/off, season selection, searchable library, kit slot order, armed-species cancellation, selected-plant measurements and note disclosures, summary open/close, solar play/pause and July baseline, and growth playback (year 10 advanced to year 32 before pausing and restoring year 10).
- Checked Walk rendering, equipment-wheel opening/closing and its four saved species, and Spectator's read-only layout. No physical Xbox input was exercised in this visual pass; movement/controller logic is unchanged.
- The seven-plant live design was not used for placement, dragging, duplication, deletion, import, or reset. Before and after JSON exports have identical SHA-256: `84c3e4e294a33bb78386a054dd5c7adfc62aac5d9a3cedf38961580fc04f8d1a`. No persistence schema, placement geometry, botanical growth, or solar calculations changed.

Survey alignment, existing-tree verification, and roof/shadow modeling uncertainty remain as documented in the interface. This pass changes presentation and access to controls.

## Full UI QA follow-up

Tested desktop, tablet (768 px), 390 × 844 and 320 × 568 phones, and 667 × 375 landscape phone layouts. Final automated checks: 101 tests across 22 files, lint, and production build. Existing bundle-size and Three.js deprecation notices remain.

Fixed issues found during the pass:

- Fixed-zoom Plan cropped the parcel on phones. Its initial framing now fits the active boundary with room for menus and collapsed solar controls; zoom/pan still work.
- The inherited 320 px body minimum caused horizontal overflow with a vertical scrollbar. Small-phone header columns and body sizing now fit the available client width.
- Short screens could clip menus and solar content. Disclosures have bounded scrolling, mobile controls have larger targets, and the canvas adapts to viewport height.
- Menu actions now return keyboard focus to their summary; Escape closes the menu before it can cancel the underlying plant selection.
- Walk consumed form/menu arrow keys. The real Walk keyboard handler now leaves those events to the control; an integration regression test verifies no movement or preventDefault while editing a field.
- Plant and ruler labels could draw over the solar panel. Annotation stacking now stays below interactive controls. Tablet source badges and dimension units no longer overlap or wrap unnecessarily.
- Wheel buttons collided in short landscape views. The wheel and buttons now scale together, and underlying help hides while the wheel is open.

Browser checks covered exclusive Project/Layers/Views opening, outside dismissal, Escape/focus restoration, selecting imagery and all three boundary sources, grid, camera reset/focus, saved-status display and JSON export, searching and kit tabs, modal Escape and Ctrl+Z isolation, season changes, growth playback including year 50 wrapping to year 0, summary values, solar playback to end of day, and July baseline restoration.

Editing checks used the separate origin 127.0.0.1:5185 with empty storage. Two fixture plants were placed. Dragging Red maple changed its center from 43.9 / -68.8 ft to 33.8 / -89.2 ft; nearest-plant distance changed from 48.0 to 30.9 ft. One undo restored the drag and redo restored the moved position. On the same unmoved fixture, aerial-aligned/original-plan/County-GIS boundary distances were 26.7 / 14.6 / 14.5 ft, with matching source labels and sidebar/line readouts. A full favorites kit rejected a fifth species; replacing one favorite updated the actual Walk wheel. Choosing it produced an unsaved carry preview and live rulers; Spectator removed both and disabled import, reset and history actions. Summary still contained exactly two plants after returning. Import, reset, deletion, serialization, controller drift, pickup and drop retain their automated integration coverage; those destructive workflows were not exercised on the live saved design. No physical Xbox hardware was operated.

The default aerial-aligned outline is a rigid 14 ft southward translation registered against the 2021 photo's pavement curve. Tests verify every vertex translation and segment length, source selection, shared measurement geometry, and that changing overlays does not mutate design or history. Original reference views remain available. This visual registration does not establish a surveyed ownership boundary; placement/collision limits remain County GIS.

The live seven-plant design's before/after exports have identical SHA-256: 84c3e4e294a33bb78386a054dd5c7adfc62aac5d9a3cedf38961580fc04f8d1a. Main-site favorites were untouched. The temporary test tab/server were closed and viewport overrides reset.
