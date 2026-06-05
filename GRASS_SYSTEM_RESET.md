# Grass System Reset

The old wilderness/local grass system has been intentionally disabled so it does not come back.

A new tutorial-inspired grass implementation is now active.

Entry point:

- `src/game/GameWorld.tsx`
- `SURVIVAL_GRASS_SYSTEM_ENABLED = true`
- `SURVIVAL_LEGACY_GRASS_SYSTEM_ENABLED = false`

This disables the old:

- `SurvivalLocalGrassField`
- `SurvivalWildflowers`

The active replacement is:

- `SurvivalTutorialGrassField`
- `SurvivalTutorialGrassCellTile`
- `makeSurvivalTutorialGrassCarpetGeometry`
- `createSurvivalTutorialGrassTuftGeometry`

Terrain, villages, trees, bushes, mana flowers, enemies, portals, and the rest of the survival world remain available.
