import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { getTerrainHeight } from "./GameWorld";
import { isHutCell } from "./Huts";
import { isMobilePerformanceMode } from "./performanceMode";

export function Bushes({ amount = 600, mapSize = 510 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const effectiveAmount = mobilePerformanceMode ? Math.min(amount, 150) : amount;
  const lastBillboardUpdateAt = useRef(0);

  const bushTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    const size = 128;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    
    ctx.clearRect(0, 0, size, size);

    function drawLobe(x: number, y: number, w: number, h: number, color: string, edge = "#182611") {
        const points = [
          [x, y - h * 0.54],
          [x + w * 0.42, y - h * 0.36],
          [x + w * 0.56, y],
          [x + w * 0.34, y + h * 0.42],
          [x, y + h * 0.56],
          [x - w * 0.34, y + h * 0.42],
          [x - w * 0.56, y],
          [x - w * 0.42, y - h * 0.36],
        ];

        ctx.beginPath();
        points.forEach(([px, py], index) => {
          if (index === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.fillStyle = edge;
        ctx.fill();

        ctx.beginPath();
        points.forEach(([px, py], index) => {
          const insetX = x + (px - x) * 0.78;
          const insetY = y + (py - y) * 0.78;
          if (index === 0) ctx.moveTo(insetX, insetY);
          else ctx.lineTo(insetX, insetY);
        });
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    // Bushes matching the cartoon reference image, but with chunkier pixel-edge definition.
    const edgeColor = "#16240f";
    const colorDark = "#416035";
    const colorMid = "#5a8643";
    const colorLight = "#7dad52";

    // Draw dark faceted background layer
    drawLobe(size * 0.25, size * 0.7, size * 0.34, size * 0.42, colorDark, edgeColor);
    drawLobe(size * 0.5, size * 0.55, size * 0.48, size * 0.52, colorDark, edgeColor);
    drawLobe(size * 0.75, size * 0.65, size * 0.34, size * 0.42, colorDark, edgeColor);
    drawLobe(size * 0.86, size * 0.8, size * 0.22, size * 0.26, colorDark, edgeColor);
    drawLobe(size * 0.14, size * 0.8, size * 0.22, size * 0.26, colorDark, edgeColor);

    // Draw mid layer
    drawLobe(size * 0.3, size * 0.75, size * 0.26, size * 0.3, colorMid, "#27411f");
    drawLobe(size * 0.5, size * 0.65, size * 0.36, size * 0.42, colorMid, "#27411f");
    drawLobe(size * 0.7, size * 0.72, size * 0.28, size * 0.32, colorMid, "#27411f");

    // Draw light layer
    drawLobe(size * 0.35, size * 0.85, size * 0.16, size * 0.18, colorLight, "#385c2b");
    drawLobe(size * 0.5, size * 0.8, size * 0.24, size * 0.24, colorLight, "#385c2b");
    drawLobe(size * 0.65, size * 0.82, size * 0.2, size * 0.22, colorLight, "#385c2b");

    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(size * 0.1, size * 0.94);
    ctx.lineTo(size * 0.18, size * 0.82);
    ctx.lineTo(size * 0.29, size * 0.89);
    ctx.lineTo(size * 0.42, size * 0.78);
    ctx.lineTo(size * 0.56, size * 0.88);
    ctx.lineTo(size * 0.69, size * 0.77);
    ctx.lineTo(size * 0.84, size * 0.86);
    ctx.lineTo(size * 0.92, size * 0.94);
    ctx.stroke();

    // Flatten bottom edge
    ctx.clearRect(0, size * 0.95, size, size * 0.05);

    // Decorative loose leaves
    function drawLeaf(x: number, y: number, color: string) {
        ctx.beginPath();
        // Simple diamond shape
        ctx.moveTo(x, y - 3);
        ctx.lineTo(x + 3, y);
        ctx.lineTo(x, y + 3);
        ctx.lineTo(x - 3, y);
        ctx.fillStyle = "#14230e";
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x, y - 2);
        ctx.lineTo(x + 2, y);
        ctx.lineTo(x, y + 2);
        ctx.lineTo(x - 2, y);
        ctx.fillStyle = color;
        ctx.fill();
    }
    drawLeaf(size * 0.1, size * 0.6, colorDark);
    drawLeaf(size * 0.9, size * 0.7, colorDark);
    drawLeaf(size * 0.25, size * 0.45, colorMid);
    drawLeaf(size * 0.75, size * 0.5, colorMid);
    drawLeaf(size * 0.45, size * 0.35, colorLight);
    drawLeaf(size * 0.55, size * 0.35, colorLight);

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
  }, []);

  const bushData = useMemo(() => {
    const data = [];
    for (let i = 0; i < effectiveAmount; i++) {
      const x = (Math.random() - 0.5) * mapSize;
      const z = (Math.random() - 0.5) * mapSize;
      const y = getTerrainHeight(x, z);
      
      // Skip spawning bushes on walls or in moats/roads
      if (y > 2.0 || y < -0.5) continue;
      
      const absX = Math.abs(x);
      const absZ = Math.abs(z);
      const R = Math.sqrt(x*x + z*z);
      
      const isRoad = absX < 12 || absZ < 12;
      const isMoat = (R > 42 && R < 58) || (R > 125 && R < 145);
      const isCentralPlaza = R < 35;
      const isPath = (absX >= 32 && absX < 40) && R > 60 && R < 125 || (absZ >= 32 && absZ < 40) && R > 60 && R < 125;
      
      if (isRoad || isMoat || isCentralPlaza || isPath) continue;
      
      const fx = Math.floor(x / 16) * 16;
      const cx = Math.ceil(x / 16) * 16;
      const fz = Math.floor(z / 16) * 16;
      const cz = Math.ceil(z / 16) * 16;

      const corners = [
        [fx, fz], [fx, cz], [cx, fz], [cx, cz]
      ];
      
      let insideHut = false;
      for (const [hx, hz] of corners) {
        if (isHutCell(hx, hz)) {
           const dx = x - hx;
           const dz = z - hz;
           if (dx * dx + dz * dz < 400) { // Radius 20 just to be safe
               insideHut = true;
               break;
           }
        }
      }
      
      if (insideHut) {
          continue;
      }
      
      const TREE_POSITIONS = [
        [0, 0],
        [25, 20],
        [-28, 15],
        [18, -26],
        [-22, -24]
      ];
      
      let insideTree = false;
      for (const [tx, tz] of TREE_POSITIONS) {
        const dx = x - tx;
        const dz = z - tz;
        if (dx * dx + dz * dz < 400) { // Radius 20 for trees
          insideTree = true;
          break;
        }
      }
      if (insideTree) {
        continue;
      }

      // Keep bushes huge to hide behind
      const heightScale = 3 + Math.random() * 4;
      const widthScale = heightScale * (1.5 + Math.random() * 2); // wider for hedge look
      data.push({ x, y: y + heightScale/2, z, widthScale, heightScale }); 
    }
    return data;
  }, [effectiveAmount, mapSize]);

  useEffect(() => {
     if (!meshRef.current) return;
     bushData.forEach((bush, i) => {
         dummy.position.set(bush.x, bush.y, bush.z);
         dummy.scale.set(bush.widthScale, bush.heightScale, 1);
         dummy.updateMatrix();
         meshRef.current.setMatrixAt(i, dummy.matrix);
         meshRef.current.setColorAt(i, new THREE.Color(1, 1, 1));
     });
     meshRef.current.count = bushData.length;
     meshRef.current.instanceMatrix.needsUpdate = true;
     if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [bushData, dummy]);

  useFrame((state) => {
     if (!meshRef.current) return;
     if (mobilePerformanceMode && state.clock.elapsedTime - lastBillboardUpdateAt.current < 1 / 6) return;
     lastBillboardUpdateAt.current = state.clock.elapsedTime;

     const camPos = state.camera.position;
     bushData.forEach((bush, i) => {
         dummy.position.set(bush.x, bush.y, bush.z);
         dummy.scale.set(bush.widthScale, bush.heightScale, 1);
         
         dummy.rotation.set(0, 0, 0);
         dummy.lookAt(camPos.x, bush.y, camPos.z);
         
         dummy.updateMatrix();
         meshRef.current.setMatrixAt(i, dummy.matrix);
     });
     meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, effectiveAmount]} receiveShadow castShadow>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={bushTexture} transparent={false} alphaTest={0.5} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
