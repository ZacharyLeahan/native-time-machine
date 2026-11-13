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
