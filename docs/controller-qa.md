# Controller review and equipment wheel

The app uses the browser Gamepad API polled in React Three Fiber's frame loop. Three.js handles camera projection and raycasting; Zustand owns transient equipment previews separately from the persisted design. No additional controller library is needed for this standard Xbox layout.

## Research and adaptation

- W3C standard mapping: https://www.w3.org/TR/gamepad/
- Browser integration and polling: https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
- Embark's controller changes and neutral-input aim-assist fix: https://www.reachthefinals.com/patchnotes/12-30
- Embark confirms the equipment-wheel feature: https://www.reachthefinals.com/patchnotes/12-00

These sources establish the platform behavior and game features, not Embark's proprietary aiming algorithm. Our adaptation uses a 25% adjustable axial deadzone, exponent 1.35 response, frame-time-scaled look, reduced zoom sensitivity, and smoothly changing FOV. Aim has no residual velocity, auto-centering, or aim assistance. This favors steady landscape inspection rather than recreating competitive combat aim assistance. Physical feel still requires the user's own controller.

## Equipment

Hold LB, point RS, release LB to equip. Releasing in the center keeps the existing tool. B cancels. Four existing native catalog entries provide canopy/understory variety: White oak, Red maple, Eastern redbud, Serviceberry. Move plants switches back to existing-plant pickup; Cancel discards a preview. Mouse-accessible buttons provide the same wheel choices.

A jumps, LT holds zoom, X picks up an aimed plant, X/RT drops or plants, L3 sprints. B cancels a held item or wheel before exiting Walk. Wheel selection consumes the right stick and pauses movement/aim. RT held while releasing the wheel cannot immediately plant: another press is required.

## QA coverage

Tests use isolated Zustand fixtures and synthetic input arrays, not the live saved garden. They cover nested tree-mesh ray targeting, house occlusion, exact neutral aim at 30/60/144 fps, six wheel sectors and neutral cancellation, button rising edges and suppressed connection-time presses, valid/invalid drops, house-crossing rejection, one placement per action, undo, and unsaved previews. Existing jump, movement/collision, persistence backup, import, and design tests remain enabled. Browser QA checks rendered controls and the wheel without planting in the live design.

Controller loss cancels previews and restores FOV; focus loss cancels previews and clears input. Keeping the original trunk's collision while carrying prevents cancellation from restoring a trunk around the walker. Reconnecting starts with a fresh button baseline. Actual USB/Bluetooth timing, mechanical stick wear and controller ergonomics are not established by these synthetic tests.

## Spectator and assisted-climb follow-up

Spectator tests additionally verify equal flight distance at 30/60/144 fps, exact neutral aim, world-relative ascent, capped diagonal speed, and design-action lockouts. Physical Xbox validation remains pending. During the follow-up the active browser preview timed out and secondary-preview button actions did not transition modes, so a complete live climb traversal could not be verified through browser automation.

The assisted-climb integration was subsequently disabled following the user's report that Walk stopped rendering and accepting controller input. WalkControls now uses the controller from commit 05d14f0, restoring ground-following movement and A-button jumping. This removes the new per-frame climb/support geometry scans and the early return that stopped all camera updates on focus loss. The geometry prototype tests remain, but do not establish that live climbing works.

Rollback verification: all 52 tests, lint, and the production build pass. After restarting an unresponsive Vite server, a fresh browser preview rendered Walk's house, terrain, and trees; holding W moved the camera, and switching Spectator → Walk rendered correctly. No plants were moved or added, and the existing seven-plant design was left intact. A physical Xbox controller was not operated during this verification; hardware validation remains pending.

## Favorites, summary, and camera shortcuts

The four plant sectors now use the separately persisted favorites list, in tray order. The six-sector geometry, LB/RS selection, X/RT planting, Move sector, Cancel sector, and aim/deadzone calculations are unchanged. Empty plant sectors cannot equip a plant; they preserve an existing carry preview. Favorites changes do not add design-history entries or modify placements.

Verification: 60 tests across 15 files pass, plus lint and the production build (the existing bundle-size warning remains). New tests cover preference parsing, stale/hidden species, stable wheel sectors, favorite replacement/equipment, empty slots, purchase-versus-existing summary data, coordinate preservation, year-dependent sizes, camera framing, and Plan-to-Garden focus without design/history changes. Browser QA at 1280×720 verified a Serviceberry → Pawpaw kit replacement survives reload and appears in the wheel, equipping creates only a preview, and Spectator cancels that preview. The original default kit was restored after testing. Front, Back, Left, Right, selected-tree focus, focus from Plan, Reset view, summary Escape dismissal, and the centered summary were visually checked. Plant selection now stops the following click from bubbling to the ground and immediately clearing the selection. The seven plants, six species, and displayed coordinates match before and after; no live planting, moving, importing, resetting, or deleting was performed. Physical Xbox input remains pending hardware verification.

## Full integration QA follow-up

73 tests across 18 files pass, plus lint and the production build. The build retains its existing bundle-size warning. New integration harnesses run the actual Walk frame callback and camera-shortcut component against simulated standard Xbox input, real Three.js raycasting, real OrbitControls, and the actual planner store. React scheduling and the browser input devices are substituted; these are not physical-controller tests.

The Walk harness verifies movement, jump, LT zoom, immediate neutral aim, favorite selection through LB/RS, suppressed movement/aim while selecting, fresh-trigger requirements, one plant per press, X pickup/drop, undo, neutral/empty slots, B cancellation with LB still held, reconnect baselining, disconnect/focus-loss cancellation, and Escape dismissal. Plant/drop/undo tests use isolated in-memory fixtures, never the live saved landscape.

The pass reproduced and fixed:

- Narrow-aspect camera shots fighting the 420-foot OrbitControls limit and potentially clipping at the 700-foot far plane. Required travel and clipping distances now expand to fit the requested shot. A 320×1280 fixture converges rather than running indefinitely.
- Stale active camera presets after manual orbit interruption. Manual control now clears the preset, avoiding an unwanted repeat on viewport resize.
- Invalid camera coordinates during zero-sized viewport transitions. Non-finite or nonpositive aspect ratios use a safe fallback.
- Background Undo/Redo while the planting-summary dialog is open. The global shortcut handler now ignores dialog descendants and text fields; normal undo/redo still pass isolated integration checks.
- Phone favorites clipping the plant catalog, and tablet toolbar/workspace overflow. The phone kit uses two compact columns; tablet layout keeps controls within the viewport.
- Missing Escape dismissal for the equipment overlay. Escape closes it without committing or discarding a carry preview.

Browser checks covered 1280×720, 900×900, and 390×844 layouts, full-kit feedback, favorites replacement and reload, wheel contents/equipping, Escape, Spectator preview cancellation, current-year summary dimensions (including year 50), narrow-screen camera framing, and Reset view. The original kit, year 10, desktop viewport and Garden mode were restored. The two live design JSON exports taken before and after QA have identical SHA-256 hashes, confirming all seven plants and every serialized field are byte-for-byte unchanged. Physical Xbox ergonomics, USB/Bluetooth timing and mechanical stick behavior still need hardware validation.

## Placement measurements and coordinate grid

83 tests across 19 files pass, plus lint and the production build (the existing bundle-size warning remains). Pure horizontal geometry tests cover perpendicular segment projection, slanted/zero-length edges, corners, exterior/on-boundary positions, recorded curved frontage versus County GIS, moving-plant exclusion, coincident centers, missing neighbors, and selection/preview visibility. Store integration verifies changing measurement controls does not touch design/history, and drag measurements update through one undoable move. The real Walk frame harness verifies measurements follow a moving carry preview without modifying saved plants.

Gold measurement lines and the sidebar use the active displayed boundary from one shared view-state setting; cyan lines use the nearest other plant center. Plant-center coordinates and distances remain in feet. Terrain sampling only drapes the lines visually: reported distances are horizontal. A carry preview takes precedence in Walk, and Spectator renders no measurement subject. All new measurement and grid geometry has raycasting disabled to preserve controller targeting and pointer selection. Zero-length dimensions retain their label/endpoint without drawing a degenerate thick line.

Live browser checks selected Red maple with the grid enabled and verified matching line/sidebar values: 28.1 ft to the fitted Lot 49 plan, 27.9 ft to County GIS, and 24.5 ft to the nearest Serviceberry. Switching the boundary updated source and distance together. Focusing the plant into Garden retained its measurements. An uncommitted Walk kit preview showed 29.3/7.3 ft boundary/neighbor distances, updating to 32.2/9.3 ft after walking; entering Spectator removed the preview and guides. No live plant was placed or moved. Plan grid visibility, origin, labeled axes, repeated toggling, clean reload, and 1280×720 / 900×900 / 390×844 layouts were inspected. The summary now labels the same existing coordinates X/Y to match the grid; serialized `xFt`/`zFt` fields are unchanged.

The live before/after design exports match byte-for-byte by SHA-256: all seven placements, IDs, metadata and version 8 serialization are preserved. The desktop viewport, year 10, original kit and recorded-boundary source were restored; grid is off by default and after QA. Physical Xbox hardware testing remains unverified. Mapped boundaries are approximate, and guide distances do not establish surveyed setbacks or pavement offsets; placement validation still uses County GIS.

## Full distance-layer QA follow-up

94 tests across 20 files pass, plus lint and the production build (the existing bundle-size warning remains). An independent cross-product distance oracle agrees with the boundary projection calculation at 510 sample positions across the two real boundary geometries. Additional tests cover concave notches, reversed polygon winding, label collision/bounds, coincident projected anchors, current-aim wheel selection, existing-tree self-exclusion after X pickup, and committing the displayed carry position at simulated 30/60/144 fps with undo.

This pass fixed four integration issues:

- Measurement lines and endpoint rings were in the opaque rendering pass, where later transparent photo shadows and canopy circles could cover them. They now use the transparent overlay pass with explicit ordering, depth testing/writing disabled, and raycasting still disabled.
- Floating name tags and dimension labels crowded each other in Plan. Plan now uses its sidebar identity and selected ring; dimension labels use deterministic screen-space placement beside the line, avoiding the plant, other dimensions and common controls where space permits. World endpoints and numeric distances are unaffected.
- Mouse wheel selections initially used a fixed world position. A shared transient aim ref now provides the live Walk camera position to the wheel before the preview is created; the ref is not serialized.
- Drop used a newer camera sample than the periodically updated visible preview. X/RT now commit the displayed preview coordinates, so the final placement matches the measured location instead of jumping ahead while moving. Placement and through-house validation remain in the existing drop action.

Real browser drag tests ran on a separate origin, `127.0.0.1:5184`, with its own empty browser storage. Two test plants were placed there; dragging Red maple changed nearest-tree distance from 26.4 to 35.9 ft, one undo restored the original position, and redo restored the move. Exact exported fixture coordinates independently produce 35.853108 ft, matching the 35.9-ft display; only the moved fixture plant changed. A second drag displayed 33.1 ft and supported one-step undo. On the restored fixture, boundary switching changed 31.6 ft (recorded fit) to 31.7 ft (County GIS), with source and sidebar/line labels agreeing. Advancing to year 50 changed canopy sizes but not center distances; overlay lines remained visible above the mature symbols. Grid alignment, clean reload, and narrow-screen carry readability were visually checked.

The Walk browser test moved before equipping, then carried an unsaved preview while walking: its coordinate/readout advanced from Y -76.8 to -70.7 ft and nearest-tree distance from 92.3 to 86.4 ft. Spectator removed the preview and guides. Physical Xbox hardware was not operated; controller behavior is verified through the actual Walk frame callback with simulated standard gamepad input.

The live design on port 5173 was never used for planting or dragging. Its before/after JSON exports are byte-for-byte identical by SHA-256, preserving all seven plants and all metadata. The temporary QA server is stopped after testing and the desktop viewport restored. Survey/GIS alignment uncertainty remains unchanged; verified math does not turn the mapped boundary into a survey.

## Walk planting-group workflow

Added Y multi-selection (up to 12), numbered markers, X group pickup, a context-sensitive LB arrangement wheel, RS planar movement, RB look override, and D-pad whole-foot boundary-guide nudges with delayed repeat. Existing unmarked X pickup and the favorites kit remain available. A D-pad step on an existing single-plant carry enters precise placement at its displayed preview location. Layouts include parallel/perpendicular rows, whole-foot even spacing, estimated mature canopy spacing (+2 ft gap), and whole-foot setback. All group operations preview first; X/RT applies atomically as one undo step, while invalid destinations reject the whole group. No saved-design schema changes.

Automated tests cover oblique boundary frames, normal/tangent orientation, whole-foot rounding, equal gaps, species-dependent canopy widths, metadata preservation, preview serialization isolation, untouched unselected plants, invalid/stale previews, one-step undo/redo, Spectator protection, Y raycast selection of three actual Three.js meshes, RS movement without camera drift, RB + RS look, LS walking without dragging the preview, D-pad repeat, LB release/fresh-trigger protection, cancellation, disconnect, and Enter on a focused Cancel button. Physical Xbox hardware was not operated; these tests run the real Walk frame callback with deterministic standard gamepad input.

Browser validation used an empty isolated origin at 127.0.0.1:5186. Placed White oak, Red maple and Serviceberry, selected all three, previewed even spacing, and applied once. One undo restored all original displayed centers (3.3/-94.3, 43.9/-68.8 and -6.9/-68.8 ft); redo restored the row (21.0/-88.1, 14.0/-76.0 and 7.0/-63.9 ft), with a 51 ft guide setback and 14 ft center gaps. The preview export still contained the original saved positions before Apply. Checked the six-sector arrangement wheel, mature-canopy preview, 390×844 and 320×568 layouts, Enter on Cancel, and Spectator clearing the preview/markers. The live seven-plant design on 5173 was never used for edits; its pre-test backup remains unchanged, and clean reload shows all seven original plants. The temporary test tab/server were closed and viewport override reset.
Final checks: 125 tests across 24 files pass, plus lint and the production build (existing bundle-size warning remains).

## View/Menu selection and selection-only measurements

Current Xbox selection uses held View (standard Gamepad button 8, overlapping squares) to sweep-add aimed plants, and Menu (button 9, three lines) to toggle one. Repeated aim hits do not toggle selections. A Menu deselection stays excluded for the rest of that View hold, including through an LB wheel pause. Selected models brighten and retain numbered markers; the reticle/status indicates active sweep selection. A held View on reconnect must be released before selection starts.

LB is contextual: zero selected opens the favorite plant kit; one opens precise move, whole-foot setback, duplicate, plant details, delete and clear/cancel; multiple opens alignment and spacing. Delete requests review and requires a fresh A press, with B/Cancel preserving the selected plant. Delete freezes movement and is one undoable edit after confirmation. Duplicate selects its new copy and is one undoable edit. No actual deletion was performed through browser QA; the real store and Walk frame callback test the confirm/delete/undo path with simulated standard gamepad input.

Selection itself now displays property-boundary and nearest-other-plant center distances plus site X/Y, without entering a move session. In a multi-selection, aiming at a selected member focuses its measurements; an aimed unselected plant does not replace the subject. Movement previews measure their displayed coordinates and other plants' preview positions. Spectator hides measurements and clears transient selection state.

X pickup of a planted tree now starts a stationary precision preview at its current center. It no longer follows the camera's 12 ft aim point. Existing aiming/wheel stick deflection is ignored until RS returns to neutral, preventing inherited movement on pickup; RS/D-pad then deliberately move the preview. New unsaved kit plants retain aim-following placement. Saved placements are untouched until Apply.

Browser QA used only the separate 5186 origin. Selecting White oak showed a 34.0 ft boundary distance and 14.0 ft nearest Red maple distance at 21.0/-88.1 ft. Entering X move preserved those exact displayed measurements/coordinates; cancellation preserved the selection. Checked single/multiple wheel contents, botanical details, delete review with Cancel initially focused, Enter cancelling safely, and the selection readout at 390×844. Final fixture summary retained all three starting positions. The live 5173 design still shows its original seven plants and was not used for mutation tests. Temporary viewport and test tab/server were reset/closed.

Final verification: 140 tests across 24 files, lint and production build pass. Coverage includes sweep persistence, Menu toggles, reconnect handling, context-dependent wheel dispatch, confirmation edges, undo, focus-loss safety, selection-only measurements, self-exclusion, and stationary X pickup with a neutral-stick gate. Physical Xbox hardware was not operated.

## X grab-and-carry correction

X now grabs the aimed plant or marked group as a camera-relative carried preview, while Menu remains stationary selection and measurement. The initial camera-local offset is captured without moving the center; grabbed plants lift visually and follow walking and camera yaw/pitch. Groups preserve their relative formation. X/RT drops the displayed ground positions atomically with one undo, and B restores the original placements. Invalid destinations and dropping through the house remain blocked. D-pad input, Move precisely, or an alignment action releases the grab into the boundary-relative precision workflow at its displayed position.

Verification: 144 tests across 25 files, lint and production build pass. New pure transform tests cover arbitrary yaw/pitch round trips without horizontal teleporting, walking translation, horizontal look and vertical look. Actual Walk frame tests cover X pickup, walking carry, camera look, RT drop, one-step undo, rigid group formation, D-pad precision transition and cancellation; controller input is simulated, not physical Xbox hardware.

Browser QA ran on isolated 5186 storage: Serviceberry started at 7.0/-63.9 ft, remained there immediately after X grab, moved to 7.0/-73.6 ft while walking backward, and to 10.8/-75.0 ft after mouse look. Cancel restored 7.0/-63.9 ft and the original 51.0 ft boundary / 14.0 ft nearest-plant readouts. No mutation tests were performed on the live seven-plant design. The temporary tab/server were closed. No design schema or saved placement data changed.

## Xbox workflow QA — November 13

Fixed two reproduced input bugs: a held View could resume selection after blur/focus without a release, and mouse movement during delete review could change the stored camera angles, causing a jump after cancellation. Focus loss now resets the View sweep and D-pad repeat latch. Mouse look ignores unfocused input and deletion review. Regression tests failed before these fixes and pass afterward. X remains camera-relative grab/carry, Menu remains selection, and LB retains its three contextual wheels.

Added actual measurement-hook integration checks at 30, 60 and 144 FPS while a two-plant selection is carried with walking, yaw and pitch input. Each frame checks all three boundary display sources against an independent segment-distance oracle, nearest-plant distances against merged preview centers, and unchanged serialized saved placements. RT commits exactly the displayed coordinates once; one undo restores the original design.

Browser verification used the isolated 5186 origin. Serviceberry selection showed 7.0/-63.9 ft, 51.0 ft to boundary and 14.0 ft to Red maple. Carrying backward updated both scene labels and sidebar to 7.0/-72.4 ft, 46.7 ft and 7.9 ft. Dropping then undoing restored the initial measurements. Checked single actions, multi-selection alignment, zero-selection favorites, and delete review with Keep plant initially focused. The live 5173 garden was inspected read-only and still shows seven plants. No schema or styling changes.

The Finals-inspired grab/look and held-LB radial navigation remain intact, with the user's custom View/Menu selection mapping. Official references: [equipment-wheel layout notes](https://www.reachthefinals.com/patchnotes/5100) and [interaction and aim settings](https://www.reachthefinals.com/patchnotes/10-00). No claim of matching proprietary game physics or aim assist. Xbox behavior is exercised with simulated standard gamepad input through the real Walk frame callback; physical controller feel remains unverified.

Verification: 149 tests across 25 files pass, plus lint and production build. Existing bundle-size and Three.js deprecation warnings remain.
