# Grass Rebuild Blueprint

Video reference: `https://youtu.be/w0bKkGqV5JQ`

Goal: rebuild wilderness grass from scratch using a Breath-of-the-Wild-style approach: local, dense, performant, and visually soft instead of square-card clumps.

## Core Idea

Use a local grass shell around the player, not chunk-wide grass that loads all at once.

The video's useful ideas are:

- Frustum culling: only draw grass in or near the camera view.
- Distance culling: grass outside the player shell is not rendered.
- LOD: detailed grass near the camera, simpler grass farther away, and terrain color/texture at long distance.
- GPU instancing: draw many blades/clumps with shared geometry and material, varying per-instance transform, color, height, bend, and wind phase.

## Implementation Shape

The first tutorial-inspired rebuild is active:

- `SURVIVAL_GRASS_SYSTEM_ENABLED = true`
- `SURVIVAL_LEGACY_GRASS_SYSTEM_ENABLED = false`

Keep the legacy grass disabled.

Future cleanup should move the new grass code out of `GameWorld.tsx` into:

- `src/game/grass/GrassField.tsx`
- `src/game/grass/GrassCells.ts`
- `src/game/grass/GrassMasks.ts`
- `src/game/grass/GrassMaterials.ts`
- `src/game/grass/GrassDebug.tsx`

## Rendering Layers

1. Near layer, 0-45m:
   - Actual low blade geometry.
   - Use instanced rendering.
   - 2-5 vertices per blade or small blade fan.
   - Wind in vertex shader.
   - Per-instance color, height, yaw, lean, wind phase.

2. Mid layer, 45-140m:
   - Small tuft clusters, not huge upright cards.
   - Use a few low clump meshes or crossed blade fans.
   - Fade density with distance.
   - No visible square alpha-card silhouettes.

3. Far layer, 140m+:
   - Terrain tint/detail only.
   - No individual grass objects.
   - Smooth fade out when flying high.

## Cell Streaming

Use grass cells independent of survival terrain chunks.

- Cell size: around 32-64 world units.
- Maintain a circular shell around the local player only.
- Multiplayer: each client renders grass locally; do not network grass instances.
- Add/remove cells gradually over multiple frames.
- Prioritize cells in front of the camera and near the player.
- Keep a small pool of reusable buffers/meshes.

## Masks

Grass placement must query masks before creating an instance:

- terrain height and normal
- water/shoreline
- town/village safe zones
- routes and paths
- structures and props
- slope limits

Paths must stay clear. If a new route/path system exists, grass should use its final mask, not its own duplicate guess.

## Visual Rules

- Avoid big rectangular transparent planes.
- Avoid giant clumps in the foreground.
- Avoid one flat green carpet.
- Use color variation from yellow-green to deep green.
- Add sparse flowers only after grass reads correctly.
- Flowers should be separate from grass density, not used as a patch fix.

## Performance Rules

- No per-frame regeneration of grass instance data.
- Regenerate only when a cell enters, exits, or its LOD changes.
- Use one or a few `THREE.InstancedMesh`/`InstancedBufferGeometry` draws per LOD/material.
- Update instance matrices/colors in batches, then set `needsUpdate` once.
- Compute and set bounds for culling.
- Test cold load and high-speed travel separately.

## Acceptance Tests

Before calling it done:

- Stand still looking level.
- Look down at the ground.
- Walk through the meadow.
- Sprint/fly across cell boundaries.
- Fly high and confirm grass fades away.
- Confirm no grass on paths, villages, water, or props.
- Capture screenshots at the restored meadow and at a second wilderness biome.
- Confirm settled frame timing and cold-load hitch timing.

The grass should read as a continuous meadow before flowers are added.
