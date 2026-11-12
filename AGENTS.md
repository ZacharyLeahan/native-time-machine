# AGENTS.md

## Mission

Maintain Native Time Machine as a usable, visually polished native-plant planning product. Prefer working vertical slices over speculative abstraction while preserving the domain boundaries below.

## Required boundaries

- Keep botanical species data in `src/data` and individual placements in the design model.
- Keep growth and coordinate math pure and independent from React, Zustand, and Three.js.
- Store physical coordinates and dimensions in feet until a deliberate unit-system migration is implemented.
- Keep seasonal appearance data-driven. Rendering components may consume it but should not own botanical facts.
- Treat persistence as a versioned boundary. Never silently change serialized fields without a migration plan.
- Add geospatial providers through adapters; do not leak provider-specific objects into core design state.

## Product conventions

- An overhead action must have an obvious visual response and work without a precision pointer where practical.
- Botanical estimates must be described as approximate unless sourced from validated model data.
- Avoid blocking the experience on photoreal assets; graceful procedural or symbolic fallbacks are expected.
- Preserve the user's current design across UI refactors.
- Maintain keyboard labels, sufficient contrast, and responsive behavior.

## Engineering workflow

1. Inspect the existing types and tests before changing a domain contract.
2. Add or update tests for simulation, transformations, or serialization changes.
3. Run `npm test`, `npm run lint`, and `npm run build` before handing off.
4. Visually inspect the rendered planner at desktop size after interaction or styling changes.
5. Keep generated output, secrets, and local environment files out of Git.

## Definition of done

A change is complete when the requested workflow works in the browser, core tests pass, TypeScript builds, the design remains serializable, and README documentation reflects material capability changes.
