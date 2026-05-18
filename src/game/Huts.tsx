import { useMemo } from "react";
import * as THREE from "three";
import { RigidBody, MeshCollider, CuboidCollider } from "@react-three/rapier";
import { Evaluator, Brush, SUBTRACTION } from "three-bvh-csg";
import { getTerrainHeight } from "./GameWorld";

export interface HutInfo {
  id: string;
  x: number;
  y: number;
  z: number;
  hutType: number;
  colorIndex: number;
  rotation: number;
  hasPath: boolean;
  pathRot: number;
  isMushroom: boolean;
  interiorWidth?: number;
  interiorDepth?: number;
  interiorHeight?: number;
  villagerBackOffset?: number;
  villagerSideOffset?: number;
  villagerYOffset?: number;
  villagerTheme?: "village" | "egyptian" | "swamp";
}

export const isRoadCell = (x: number, z: number) => {
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const R = Math.sqrt(x * x + z * z);
  const isRoad = absX < 24 || absZ < 24;
  const isCentralPlaza = R < 45;
  const isPath = (absX >= 24 && absX < 48) && R > 60 && R < 125 || (absZ >= 24 && absZ < 48) && R > 60 && R < 125;
  return isRoad || isCentralPlaza || isPath;
};

export const isBlockingCell = (x: number, z: number) => {
  const absX = Math.abs(x);
  const absZ = Math.abs(z);
  const R = Math.sqrt(x * x + z * z);

  if (absX >= 230 || absZ >= 230) return false; // Don't spawn huts inside/on the forest wall

  const isMoat = (R > 30 && R < 70) || (R > 112 && R < 158);
  if (isRoadCell(x, z) || isMoat) return false;

  const TREE_POSITIONS = [
    [0, 0],
    [25, 20],
    [-28, 15],
    [18, -26],
    [-22, -24]
  ];
  for (const [tx, tz] of TREE_POSITIONS) {
    if (Math.abs(x - tx) < 20 && Math.abs(z - tz) < 20) {
      return false;
    }
  }

  const cx = Math.floor((x + 256) / 16);
  const cz = Math.floor((z + 256) / 16);
  const hash = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453;
  return (hash - Math.floor(hash)) <= 0.65;
};

// Helper to determine if a cell is a wall/hut (same as GameWorld logic)
export const isHutCell = (x: number, z: number) => {
  return isBlockingCell(x, z);
};

export const getHutList = (): HutInfo[] => {
  const list: HutInfo[] = [];
  for (let x = -240; x <= 240; x += 16) {
    for (let z = -240; z <= 240; z += 16) {
      if (isHutCell(x, z)) {
        const cx = Math.floor((x + 256) / 16);
        const cz = Math.floor((z + 256) / 16);
        const uniqueHash = Math.sin(cx * 3.123 + cz * 4.412) * 1000;
        const hashVal = uniqueHash - Math.floor(uniqueHash);
        
        let hutType = 0;
        if (hashVal > 0.5) hutType = 0;      // 0: Mushroom (Original)
        else if (hashVal > 0.33) hutType = 1;  // 1: Grass Mound (Original)
        else if (hashVal > 0.16) hutType = 2; // 2: Log Hut
        else hutType = 3;                     // 3: Dirt Hut with Grass Roof
        
        const colorIndex = Math.floor(Math.abs(uniqueHash * 1000)) % 4; // Use Math.abs and % 4
        
        const blockedZPos = isBlockingCell(x, z + 16);
        const blockedXPos = isBlockingCell(x + 16, z);
        const blockedZNeg = isBlockingCell(x, z - 16);
        const blockedXNeg = isBlockingCell(x - 16, z);

        const validRotations = [];
        if (!blockedZPos) validRotations.push(0);           // +Z
        if (!blockedXPos) validRotations.push(Math.PI / 2); // +X
        if (!blockedZNeg) validRotations.push(Math.PI);     // -Z
        if (!blockedXNeg) validRotations.push(-Math.PI / 2);// -X

        if (validRotations.length === 0) continue;

        const roadRotations = [];
        if (isRoadCell(x, z + 16)) roadRotations.push(0);
        if (isRoadCell(x + 16, z)) roadRotations.push(Math.PI / 2);
        if (isRoadCell(x, z - 16)) roadRotations.push(Math.PI);
        if (isRoadCell(x - 16, z)) roadRotations.push(-Math.PI / 2);

        let rotation = 0;
        let hasPath = false;
        let pathRot = 0;
        
        if (roadRotations.length > 0) {
          rotation = roadRotations[Math.floor(Math.abs(uniqueHash * 100)) % roadRotations.length];
          hasPath = true;
          pathRot = rotation;
        } else {
          rotation = validRotations[Math.floor(Math.abs(uniqueHash * 100)) % validRotations.length];
        }
        
        const y = getTerrainHeight(x, z);
        
        list.push({ id: `${x}-${z}`, x, y, z, hutType, colorIndex, rotation, hasPath, pathRot, isMushroom: hutType === 0 });
      }
    }
  }
  return list;
};

export function Huts() {
  // --- Textures ---
  const mushroomCapTextures = useMemo(() => {
    const colors = ["#DB0F27", "#00ff00", "#3877FC", "#b57edc"]; // Added lavender
    return colors.map(color => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = "#ffffff";
        for (let i = 0; i < 6; i++) {
          const size = 16 + Math.random() * 16;
          ctx.fillRect(
             10 + Math.random() * 90, 
             10 + Math.random() * 90, 
             size, 
             size
          );
        }
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return tex;
    });
  }, []);

  const stemWallTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f4f1ea"; // whiteish
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "rgba(0,0,0,0.05)";
      for(let x=0; x<128; x+=16) {
        ctx.fillRect(x + Math.random()*4, 0, 2, 128);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const dirtDoorTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#4a3525"; // brown wood
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = "#332211";
      for(let x=0; x<64; x+=8) {
        ctx.fillRect(x, 0, 1, 64);
      }
      ctx.fillStyle = "#111"; // knob
      ctx.fillRect(48, 30, 4, 4);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const grassTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#3a6828"; // base grass
      ctx.fillRect(0, 0, 128, 128);
      for(let i=0; i<4000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(42, 74, 26, 0.6)" : "rgba(60, 110, 40, 0.6)";
        ctx.fillRect(Math.floor(Math.random() * 128), Math.floor(Math.random() * 128), 2, 2);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const logTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Base color: light clay / mud for the chinking
      ctx.fillStyle = "#89755b";
      ctx.fillRect(0, 0, 128, 128);
      
      const logHeight = 64; 
      for (let y = 0; y < 128; y += logHeight) {
        // Leave space for chinking
        const logTop = y + 6;
        const logH = logHeight - 12;

        ctx.fillStyle = "#2a1c12"; // dark weathered brown logs (TreeHouse WOOD_COLOR)
        ctx.fillRect(0, logTop, 128, logH);

        // Shadow below log onto the chinking
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(0, logTop + logH, 128, 3);
        
        // Highlight on top edge of log
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(0, logTop, 128, 2);

        // Bottom shadow on log itself
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(0, logTop + logH - 4, 128, 4);
        
        // horizontal grain lines
        for (let i = 0; i < 60; i++) {
           ctx.fillStyle = Math.random() > 0.5 ? "rgba(20, 10, 5, 0.5)" : "rgba(80, 50, 20, 0.3)";
           const x = Math.random() * 128;
           const len = 10 + Math.random() * 40;
           ctx.fillRect(x, logTop + 2 + Math.random() * (logH - 6), len, 1 + Math.random());
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, ['v2']);

  const dirtGrassTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Base dirt colors
      const dirtColors = ["#866043", "#745239", "#694931", "#5d412b"];
      // Grass colors (matching terrain)
      const grassColors = ["#3a6828", "#2a4a1a", "#3c6e28"];

      // Fill with dirt
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          ctx.fillStyle = dirtColors[Math.floor(Math.random() * dirtColors.length)];
          ctx.fillRect(x * 8, y * 8, 8, 8);
        }
      }

      // Top grass layer
      for (let x = 0; x < 16; x++) {
        // grass goes down 4 to 8 blocks on the texture
        const depth = 4 + Math.floor(Math.random() * 5);
        for (let y = 0; y < depth; y++) {
          ctx.fillStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
          ctx.fillRect(x * 8, y * 8, 8, 8);
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 1);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, ['v2']);

  const woodPlankTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#8b5a2b"; // wood base color
      ctx.fillRect(0, 0, 128, 128);
      // Plank lines
      ctx.fillStyle = "#5c3317";
      for (let x = 0; x < 128; x += 32) {
        ctx.fillRect(x, 0, 2, 128);
      }
      // Wood grain lines
      ctx.fillStyle = "rgba(60, 30, 10, 0.4)";
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * 128;
        const y = Math.random() * 128;
        const len = 10 + Math.random() * 30;
        ctx.fillRect(x, y, 1, len);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  const dirtWallTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#7c7c7c"; // greyish stonework
      ctx.fillRect(0, 0, 128, 128);
      ctx.fillStyle = "#5c5c5c";
      for(let y=0; y<128; y+=16) {
        ctx.fillRect(0, y, 128, 2);
        for(let x=0; x<128; x+=32) {
           const offset = (y/16)%2 === 0 ? 0 : 16;
           ctx.fillRect(x + offset, y, 2, 16);
        }
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 1);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, []);

  // --- Geometries & Materials ---
  const mushroomGeo = useMemo(() => {
    const geo = new THREE.CylinderGeometry(6 / Math.SQRT2, 18 / Math.SQRT2, 10, 4);
    geo.rotateY(Math.PI / 4);
    return geo;
  }, []);

  const [stemGeo, hollowStemGeo] = useMemo(() => {
    const evaluator = new Evaluator();
    
    // Normal stem
    const solidGeo = new THREE.BoxGeometry(12, 8, 12); // -4 to 4
    
    // Hollow stem
    const outerBrush = new Brush(solidGeo);
    outerBrush.updateMatrixWorld();
    
    const innerGeo = new THREE.BoxGeometry(10, 8.0, 10);
    const innerBrush = new Brush(innerGeo);
    innerBrush.position.y = -0.5; // -4.5 to 3.5, safely avoiding the top face at 4.0
    innerBrush.updateMatrixWorld();
    
    const doorGeo = new THREE.BoxGeometry(3, 4.2, 5);
    const doorBrush = new Brush(doorGeo);
    doorBrush.position.set(0, -2, 6);
    doorBrush.updateMatrixWorld();
    
    let res = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);
    res = evaluator.evaluate(res, doorBrush, SUBTRACTION);
    
    return [solidGeo, res.geometry];
  }, []);

  const [grassMoundGeo, hollowGrassMoundGeo] = useMemo(() => {
    const evaluator = new Evaluator();
    
    // Normal Grass Mound
    const solidGeo = new THREE.CylinderGeometry(8 / Math.SQRT2, 18 / Math.SQRT2, 12, 4); // -6 to 6
    solidGeo.rotateY(Math.PI / 4);
    
    const outerBrush = new Brush(solidGeo);
    outerBrush.updateMatrixWorld();
    
    const innerGeo = new THREE.CylinderGeometry(7 / Math.SQRT2, 16 / Math.SQRT2, 12, 4);
    innerGeo.rotateY(Math.PI / 4);
    const innerBrush = new Brush(innerGeo);
    innerBrush.position.y = -0.5; // -6.5 to 5.5, safely avoiding the top face at 6.0
    innerBrush.updateMatrixWorld();
    
    const doorBrush = new Brush(new THREE.BoxGeometry(3, 4.2, 10));
    doorBrush.position.set(0, -4, 7.5);
    doorBrush.updateMatrixWorld();
    
    let res = evaluator.evaluate(outerBrush, innerBrush, SUBTRACTION);
    res = evaluator.evaluate(res, doorBrush, SUBTRACTION);
    
    return [solidGeo, res.geometry];
  }, []);
  
  const [entranceGeo, hollowEntranceGeo] = useMemo(() => {
    const evaluator = new Evaluator();
    
    const solidGeo = new THREE.BoxGeometry(6, 6, 2);
    
    const outerBrush = new Brush(solidGeo);
    outerBrush.updateMatrixWorld();
    
    const holeBrush = new Brush(new THREE.BoxGeometry(3, 4.2, 3));
    holeBrush.position.set(0, -1, 0);
    holeBrush.updateMatrixWorld();
    
    const res = evaluator.evaluate(outerBrush, holeBrush, SUBTRACTION);
    return [solidGeo, res.geometry];
  }, []);

  const doorGeo = useMemo(() => new THREE.PlaneGeometry(3, 4), []);
  const windowGeo = useMemo(() => new THREE.PlaneGeometry(1.5, 1.5), []);
  const topRoofGeo = useMemo(() => new THREE.BoxGeometry(8, 0.4, 8), []);
  const unitBoxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const floorGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const mushroomMats = useMemo(() => {
    return mushroomCapTextures.map(tex => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide }));
  }, [mushroomCapTextures]);
  const stemMat = useMemo(() => new THREE.MeshStandardMaterial({ map: stemWallTexture, roughness: 1.0, side: THREE.DoubleSide }), [stemWallTexture]);
  const grassMat = useMemo(() => new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 1.0, side: THREE.DoubleSide }), [grassTexture]);
  const stoneworkMat = useMemo(() => new THREE.MeshStandardMaterial({ map: dirtWallTexture, roughness: 0.9, side: THREE.DoubleSide }), [dirtWallTexture]);
  const doorMat = useMemo(() => new THREE.MeshStandardMaterial({ map: dirtDoorTexture, roughness: 1.0, side: THREE.DoubleSide }), [dirtDoorTexture]);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#88ccff", roughness: 0.2 }), []);
  const woodPlankMat = useMemo(() => new THREE.MeshStandardMaterial({ map: woodPlankTexture, roughness: 0.9 }), [woodPlankTexture]);
  const logMat = useMemo(() => new THREE.MeshStandardMaterial({ map: logTexture, roughness: 0.9, side: THREE.DoubleSide }), [logTexture]);
  const dirtGrassMat = useMemo(() => new THREE.MeshStandardMaterial({ map: dirtGrassTexture, roughness: 1.0, side: THREE.DoubleSide }), [dirtGrassTexture]);

  // --- Lantern & Pole Geometries & Materials ---
  const ironMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0.8 }), []);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#ffb84d" }), []);

  const lanternBaseGeo = useMemo(() => new THREE.BoxGeometry(1.6, 0.4, 1.6), []);
  const lanternTopGeo1 = useMemo(() => new THREE.BoxGeometry(1.6, 0.4, 1.6), []);
  const lanternTopGeo2 = useMemo(() => new THREE.BoxGeometry(1.0, 0.4, 1.0), []);
  const lanternGlassGeo = useMemo(() => new THREE.BoxGeometry(1.1, 1.6, 1.1), []);
  const lanternFrameGeo = useMemo(() => new THREE.BoxGeometry(0.2, 1.6, 0.2), []);
  const chainGeo = useMemo(() => new THREE.BoxGeometry(0.2, 2, 0.2), []);

  const poleVertGeo = useMemo(() => new THREE.BoxGeometry(0.8, 16, 0.8), []);
  const poleHorizGeo = useMemo(() => new THREE.BoxGeometry(0.8, 0.8, 6), []);
  const poleAngleGeo = useMemo(() => {
     const geo = new THREE.BoxGeometry(0.6, 0.6, 3);
     geo.rotateX(-Math.PI / 4);
     return geo;
  }, []);

  const Lantern = ({ position, chainLength = 2 }: { position: [number, number, number], chainLength?: number }) => (
    <group position={position}>
      {/* Hitboxes */}
      <CuboidCollider args={[0.1, chainLength / 2, 0.1]} position={[0, 1.2 + chainLength/2, 0]} />
      <CuboidCollider args={[0.8, 1.3, 0.8]} position={[0, -0.1, 0]} />

      <mesh geometry={chainGeo} scale={[1, chainLength / 2, 1]} material={ironMat} position={[0, 1.2 + chainLength/2, 0]} castShadow />
      
      <mesh geometry={lanternTopGeo2} material={ironMat} position={[0, 1.0, 0]} castShadow />
      <mesh geometry={lanternTopGeo1} material={ironMat} position={[0, 0.6, 0]} castShadow />
      
      <mesh geometry={lanternGlassGeo} material={glowMat} position={[0, -0.4, 0]} />
      
      <mesh geometry={lanternFrameGeo} material={ironMat} position={[-0.7, -0.4, -0.7]} castShadow />
      <mesh geometry={lanternFrameGeo} material={ironMat} position={[0.7, -0.4, -0.7]} castShadow />
      <mesh geometry={lanternFrameGeo} material={ironMat} position={[-0.7, -0.4, 0.7]} castShadow />
      <mesh geometry={lanternFrameGeo} material={ironMat} position={[0.7, -0.4, 0.7]} castShadow />
      
      <mesh geometry={lanternBaseGeo} material={ironMat} position={[0, -1.4, 0]} castShadow />
    </group>
  );

  const huts = useMemo(() => getHutList(), []);

  return (
    <>
      {huts.map((hut) => (
        <RigidBody key={hut.id} type="fixed" position={[hut.x, hut.y, hut.z]} colliders={false}>
          {hut.hasPath && (
             <group rotation={[0, hut.pathRot, 0]}>
               <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.05, 10]}>
                 <planeGeometry args={[3, 12]} />
                 <meshStandardMaterial color="#c2a077" />
               </mesh>
             </group>
          )}
          {hut.hutType === 0 && ( // Mushroom
            <group rotation={[0, hut.rotation, 0]}>
              <group>
                <MeshCollider type="trimesh">
                  <mesh geometry={floorGeo} material={woodPlankMat} scale={[10, 1, 10]} position={[0, 0.1, 0]} receiveShadow />
                  <mesh geometry={hollowStemGeo} material={stemMat} position={[0, 4, 0]} castShadow receiveShadow />
                  <mesh geometry={mushroomGeo} material={mushroomMats[hut.colorIndex]} position={[0, 13, 0]} castShadow receiveShadow />
                </MeshCollider>
                
                <mesh geometry={doorGeo} material={doorMat} position={[0, 2, 6.01]} castShadow />
                <mesh geometry={windowGeo} material={glassMat} position={[-3.5, 4.5, 6.01]} />
                <mesh geometry={windowGeo} material={glassMat} position={[3.5, 4.5, 6.01]} />
                <Lantern position={[7.5, 6, 7.5]} chainLength={2.5} />
              </group>
            </group>
          )}

          {hut.hutType === 1 && ( // Grass Mound
            <group rotation={[0, hut.rotation, 0]}>
              <group>
                <MeshCollider type="trimesh">
                  <mesh geometry={floorGeo} material={woodPlankMat} scale={[16, 1, 16]} position={[0, 0.1, 0]} receiveShadow />
                  <mesh geometry={hollowGrassMoundGeo} material={grassMat} position={[0, 6, 0]} castShadow receiveShadow />
                  <mesh geometry={hollowEntranceGeo} material={stoneworkMat} position={[0, 3, 7.5]} castShadow receiveShadow />
                </MeshCollider>
                
                <mesh geometry={doorGeo} material={doorMat} position={[0, 2, 8.51]} />
                
                <group>
                  <CuboidCollider args={[0.4, 8, 0.4]} position={[-3, 8, 2]} />
                  <CuboidCollider args={[0.4, 0.4, 3]} position={[-3, 15.6, 5.6]} />
                  <CuboidCollider args={[0.3, 0.3, 1.5]} position={[-3, 14.2, 3.2]} rotation={[-Math.PI / 4, 0, 0]} />
                  <mesh geometry={poleVertGeo} material={ironMat} position={[-3, 8, 2]} castShadow />
                  <mesh geometry={poleHorizGeo} material={ironMat} position={[-3, 15.6, 5.6]} castShadow />
                  <mesh geometry={poleAngleGeo} material={ironMat} position={[-3, 14.2, 3.2]} castShadow />
                </group>
                <Lantern position={[-3, 13, 9.2]} chainLength={3} />
              </group>
            </group>
          )}

          {hut.hutType === 2 && ( // Log Hut
            <group rotation={[0, hut.rotation, 0]}>
              <group>
                <MeshCollider type="trimesh">
                  <mesh geometry={floorGeo} material={woodPlankMat} scale={[16, 1, 16]} position={[0, 0.1, 0]} receiveShadow />
                  
                  <mesh geometry={hollowGrassMoundGeo} material={logMat} position={[0, 6, 0]} castShadow receiveShadow />
                  <mesh geometry={hollowEntranceGeo} material={logMat} position={[0, 3, 7.5]} castShadow receiveShadow />
                  <mesh geometry={topRoofGeo} material={woodPlankMat} position={[0, 12, 0]} castShadow receiveShadow />
                </MeshCollider>
                
                <mesh geometry={doorGeo} material={doorMat} position={[0, 2, 8.51]} />
                
                <group>
                  <CuboidCollider args={[0.4, 8, 0.4]} position={[-3, 8, 2]} />
                  <CuboidCollider args={[0.4, 0.4, 3]} position={[-3, 15.5, 5]} />
                  <mesh geometry={poleVertGeo} material={ironMat} position={[-3, 8, 2]} castShadow />
                  <mesh geometry={poleHorizGeo} material={ironMat} position={[-3, 15.5, 5]} castShadow />
                </group>
                <Lantern position={[-3, 13, 9.2]} chainLength={3} />
              </group>
            </group>
          )}

          {hut.hutType === 3 && ( // Dirt/Stone Hut with Grass Roof
            <group rotation={[0, hut.rotation, 0]}>
              <group>
                <MeshCollider type="trimesh">
                  <mesh geometry={floorGeo} material={woodPlankMat} scale={[16, 1, 16]} position={[0, 0.1, 0]} receiveShadow />
                  
                  <mesh geometry={hollowGrassMoundGeo} material={dirtGrassMat} position={[0, 6, 0]} castShadow receiveShadow />
                  <mesh geometry={hollowEntranceGeo} material={stoneworkMat} position={[0, 3, 7.5]} castShadow receiveShadow />
                  <mesh geometry={topRoofGeo} material={grassMat} position={[0, 12, 0]} castShadow receiveShadow />
                </MeshCollider>
                
                <mesh geometry={doorGeo} material={doorMat} position={[0, 2, 8.51]} />
                
                <group>
                  <CuboidCollider args={[0.4, 8, 0.4]} position={[-3, 8, 2]} />
                  <CuboidCollider args={[0.4, 0.4, 3]} position={[-3, 15.5, 5]} />
                  <mesh geometry={poleVertGeo} material={ironMat} position={[-3, 8, 2]} castShadow />
                  <mesh geometry={poleHorizGeo} material={ironMat} position={[-3, 15.5, 5]} castShadow />
                </group>
                <Lantern position={[-3, 13, 9.2]} chainLength={3} />
              </group>
            </group>
          )}
        </RigidBody>
      ))}
    </>
  );
}
