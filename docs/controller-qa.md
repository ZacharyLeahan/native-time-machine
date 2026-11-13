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
