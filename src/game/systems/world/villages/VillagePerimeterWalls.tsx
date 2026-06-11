import { useMemo } from "react";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

const VILLAGE_WALL_CENTER_Y = 6;
const VILLAGE_WALL_HALF_HEIGHT = 6;
const VILLAGE_WALL_HALF_THICKNESS = 4;
const VILLAGE_WALL_CENTER_OFFSET = 238;

type GateSide = "north" | "south" | "east" | "west";

function CastleWall({
  position,
  args,
  texture,
  rotation,
}: {
  position: [number, number, number];
  args: [number, number, number];
  texture: THREE.Texture;
  rotation?: [number, number, number];
}) {
  const [width, height, depth] = args;
  const tex = useMemo(() => {
    const t = texture.clone();
    t.needsUpdate = true;
    const isXLong = width > depth;
    const len = isXLong ? width : depth;
    t.repeat.set(len / 12, height / 12);
    return t;
  }, [texture, width, height, depth]);

  return (
    <mesh position={position} rotation={rotation || [0, 0, 0]} receiveShadow castShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial map={tex} roughness={0.8} />
    </mesh>
  );
}

function VillageGateArch({ side, texture }: { side: GateSide; texture: THREE.Texture }) {
  const z = side === "north" ? -238 : side === "south" ? 238 : 0;
  const x = side === "east" ? 238 : side === "west" ? -238 : 0;
  const isNorthSouth = side === "north" || side === "south";

  if (isNorthSouth) {
    return (
      <group name={`village-gate-arch-${side}`}>
        <CastleWall position={[-38, 8, z]} args={[8, 16, 10]} texture={texture} />
        <CastleWall position={[38, 8, z]} args={[8, 16, 10]} texture={texture} />
        <CastleWall position={[0, 17.5, z]} args={[84, 5, 10]} texture={texture} />
        <CastleWall position={[0, 21, z]} args={[18, 4, 10]} texture={texture} />
        <mesh position={[0, 15.25, z]} rotation={[0, 0, Math.PI / 4]} castShadow receiveShadow>
          <boxGeometry args={[8, 8, 10]} />
          <meshStandardMaterial map={texture} roughness={0.82} />
        </mesh>
      </group>
    );
  }

  return (
    <group name={`village-gate-arch-${side}`}>
      <CastleWall position={[x, 8, -38]} args={[10, 16, 8]} texture={texture} />
      <CastleWall position={[x, 8, 38]} args={[10, 16, 8]} texture={texture} />
      <CastleWall position={[x, 17.5, 0]} args={[10, 5, 84]} texture={texture} />
      <CastleWall position={[x, 21, 0]} args={[10, 4, 18]} texture={texture} />
      <mesh position={[x, 15.25, 0]} rotation={[Math.PI / 4, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[10, 8, 8]} />
        <meshStandardMaterial map={texture} roughness={0.82} />
      </mesh>
    </group>
  );
}

function VillagePerimeterWallVisuals({ wallTexture }: { wallTexture: THREE.Texture }) {
  return (
    <>
      <CastleWall position={[-136, 6, -238]} args={[208, 12, 8]} texture={wallTexture} />
      <CastleWall position={[136, 6, -238]} args={[208, 12, 8]} texture={wallTexture} />
      <CastleWall position={[-136, 6, 238]} args={[208, 12, 8]} texture={wallTexture} />
      <CastleWall position={[136, 6, 238]} args={[208, 12, 8]} texture={wallTexture} />
      <CastleWall position={[-238, 6, -136]} args={[8, 12, 208]} texture={wallTexture} />
      <CastleWall position={[-238, 6, 136]} args={[8, 12, 208]} texture={wallTexture} />
      <CastleWall position={[238, 6, -136]} args={[8, 12, 208]} texture={wallTexture} />
      <CastleWall position={[238, 6, 136]} args={[8, 12, 208]} texture={wallTexture} />
      <VillageGateArch side="north" texture={wallTexture} />
      <VillageGateArch side="south" texture={wallTexture} />
      <VillageGateArch side="east" texture={wallTexture} />
      <VillageGateArch side="west" texture={wallTexture} />
    </>
  );
}

function VillagePerimeterWallColliders() {
  return (
    <>
      <CuboidCollider args={[104, VILLAGE_WALL_HALF_HEIGHT, VILLAGE_WALL_HALF_THICKNESS]} position={[-136, VILLAGE_WALL_CENTER_Y, -VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[104, VILLAGE_WALL_HALF_HEIGHT, VILLAGE_WALL_HALF_THICKNESS]} position={[136, VILLAGE_WALL_CENTER_Y, -VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[104, VILLAGE_WALL_HALF_HEIGHT, VILLAGE_WALL_HALF_THICKNESS]} position={[-136, VILLAGE_WALL_CENTER_Y, VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[104, VILLAGE_WALL_HALF_HEIGHT, VILLAGE_WALL_HALF_THICKNESS]} position={[136, VILLAGE_WALL_CENTER_Y, VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[VILLAGE_WALL_HALF_THICKNESS, VILLAGE_WALL_HALF_HEIGHT, 104]} position={[-VILLAGE_WALL_CENTER_OFFSET, VILLAGE_WALL_CENTER_Y, -136]} />
      <CuboidCollider args={[VILLAGE_WALL_HALF_THICKNESS, VILLAGE_WALL_HALF_HEIGHT, 104]} position={[-VILLAGE_WALL_CENTER_OFFSET, VILLAGE_WALL_CENTER_Y, 136]} />
      <CuboidCollider args={[VILLAGE_WALL_HALF_THICKNESS, VILLAGE_WALL_HALF_HEIGHT, 104]} position={[VILLAGE_WALL_CENTER_OFFSET, VILLAGE_WALL_CENTER_Y, -136]} />
      <CuboidCollider args={[VILLAGE_WALL_HALF_THICKNESS, VILLAGE_WALL_HALF_HEIGHT, 104]} position={[VILLAGE_WALL_CENTER_OFFSET, VILLAGE_WALL_CENTER_Y, 136]} />
      <CuboidCollider args={[4, 8, 5]} position={[-38, 8, -VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[4, 8, 5]} position={[38, 8, -VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[4, 8, 5]} position={[-38, 8, VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[4, 8, 5]} position={[38, 8, VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[5, 8, 4]} position={[-VILLAGE_WALL_CENTER_OFFSET, 8, -38]} />
      <CuboidCollider args={[5, 8, 4]} position={[-VILLAGE_WALL_CENTER_OFFSET, 8, 38]} />
      <CuboidCollider args={[5, 8, 4]} position={[VILLAGE_WALL_CENTER_OFFSET, 8, -38]} />
      <CuboidCollider args={[5, 8, 4]} position={[VILLAGE_WALL_CENTER_OFFSET, 8, 38]} />
    </>
  );
}

export function VillagePerimeterWalls({ wallTexture, collidable = true }: { wallTexture: THREE.Texture; collidable?: boolean }) {
  if (!collidable) {
    return (
      <group name="village-perimeter-walls-visual">
        <VillagePerimeterWallVisuals wallTexture={wallTexture} />
      </group>
    );
  }

  return (
    <RigidBody type="fixed" colliders={false} name="village-perimeter-walls">
      <VillagePerimeterWallVisuals wallTexture={wallTexture} />
      <VillagePerimeterWallColliders />
    </RigidBody>
  );
}

export function ClosedArenaWalls({ wallTexture }: { wallTexture: THREE.Texture }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CastleWall position={[0, 6, -238]} args={[480, 12, 8]} texture={wallTexture} />
      <CastleWall position={[0, 6, 238]} args={[480, 12, 8]} texture={wallTexture} />
      <CastleWall position={[-238, 6, 0]} args={[8, 12, 468]} texture={wallTexture} />
      <CastleWall position={[238, 6, 0]} args={[8, 12, 468]} texture={wallTexture} />

      <CuboidCollider args={[240, VILLAGE_WALL_HALF_HEIGHT, VILLAGE_WALL_HALF_THICKNESS]} position={[0, VILLAGE_WALL_CENTER_Y, -VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[240, VILLAGE_WALL_HALF_HEIGHT, VILLAGE_WALL_HALF_THICKNESS]} position={[0, VILLAGE_WALL_CENTER_Y, VILLAGE_WALL_CENTER_OFFSET]} />
      <CuboidCollider args={[VILLAGE_WALL_HALF_THICKNESS, VILLAGE_WALL_HALF_HEIGHT, 234]} position={[VILLAGE_WALL_CENTER_OFFSET, VILLAGE_WALL_CENTER_Y, 0]} />
      <CuboidCollider args={[VILLAGE_WALL_HALF_THICKNESS, VILLAGE_WALL_HALF_HEIGHT, 234]} position={[-VILLAGE_WALL_CENTER_OFFSET, VILLAGE_WALL_CENTER_Y, 0]} />
    </RigidBody>
  );
}
