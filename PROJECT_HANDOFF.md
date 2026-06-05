# Project Handoff

This package is meant to continue development on another desktop.

## Start

```powershell
npm ci
npm run dev
```

Then open the local Vite URL, usually:

```text
http://localhost:3000
```

## Grass

The broken legacy wilderness grass remains disabled, and a new tutorial-inspired instanced grass shell is active. See `GRASS_SYSTEM_RESET.md` and `GRASS_REBUILD_BLUEPRINT.md`.

The switches are in `src/game/GameWorld.tsx`:

```ts
const SURVIVAL_GRASS_SYSTEM_ENABLED = true;
const SURVIVAL_LEGACY_GRASS_SYSTEM_ENABLED = false;
```

Continue future grass work in the new tutorial grass components instead of re-enabling the legacy system.
