import { useFrame } from "@react-three/fiber";
import { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import { getActiveQuestNavigationTargets, type QuestNavigationTarget, useGameStore } from "../../../store/gameStore";
import { isMobilePerformanceMode } from "../input/performanceMode";

let cachedQuestBeaconTexture: THREE.CanvasTexture | null = null;
const MOBILE_QUEST_BEACON_UPDATE_INTERVAL_SECONDS = 1 / 24;

function getQuestBeaconTexture() {
  if (cachedQuestBeaconTexture) return cachedQuestBeaconTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.beginPath();
    ctx.moveTo(32, 5);
    ctx.lineTo(59, 32);
    ctx.lineTo(32, 59);
    ctx.lineTo(5, 32);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#f9a8d4";
    ctx.fillRect(29, 16, 6, 24);
    ctx.fillRect(28, 45, 8, 7);
    ctx.fillStyle = "#fff7ad";
    ctx.fillRect(30, 17, 3, 23);
    ctx.fillRect(29, 46, 4, 5);
  }

  cachedQuestBeaconTexture = new THREE.CanvasTexture(canvas);
  cachedQuestBeaconTexture.magFilter = THREE.NearestFilter;
  cachedQuestBeaconTexture.minFilter = THREE.NearestFilter;
  cachedQuestBeaconTexture.colorSpace = THREE.SRGBColorSpace;
  cachedQuestBeaconTexture.needsUpdate = true;
  return cachedQuestBeaconTexture;
}

function getQuestBeaconColor(tone: QuestNavigationTarget["tone"]) {
  switch (tone) {
    case "field":
      return "#a7f3d0";
    case "brew":
      return "#fcd34d";
    case "realm":
      return "#c084fc";
    case "turn-in":
      return "#f9a8d4";
    default:
      return "#67e8f9";
  }
}

type QuestBeaconNodeKey = "group" | "beam" | "ring";

type QuestBeaconNodes = {
  group?: THREE.Group;
  beam?: THREE.Mesh;
  ring?: THREE.Mesh;
};

function QuestNavigationBeacon({
  target,
  registerNode,
}: {
  target: QuestNavigationTarget;
  registerNode: (targetId: string, nodeKey: QuestBeaconNodeKey, node: THREE.Object3D | null) => void;
}) {
  const spriteTexture = useMemo(() => getQuestBeaconTexture(), []);
  const color = getQuestBeaconColor(target.tone);

  return (
    <group
      ref={(node) => registerNode(target.id, "group", node)}
      name={`quest-beacon-${target.id}`}
      position={[target.x, target.y, target.z]}
    >
      <mesh ref={(node) => registerNode(target.id, "beam", node)} position={[0, 54, 0]} frustumCulled={false}>
        <cylinderGeometry args={[1.8, 1.8, 108, 10, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.24} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh ref={(node) => registerNode(target.id, "ring", node)} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <ringGeometry args={[5.6, 7.4, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.72} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <circleGeometry args={[4.2, 28]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} toneMapped={false} />
      </mesh>
      <sprite position={[0, 12.5, 0]} scale={[11, 11, 1]} frustumCulled={false}>
        <spriteMaterial map={spriteTexture} color={color} transparent opacity={0.96} depthWrite={false} depthTest={false} toneMapped={false} />
      </sprite>
    </group>
  );
}

export function QuestNavigationBeacons() {
  const spellQuestAssignments = useGameStore(s => s.spellQuestAssignments);
  const questFlags = useGameStore(s => s.questFlags);
  const questUnlockedSpells = useGameStore(s => s.questUnlockedSpells);
  const questNpcPrograms = useGameStore(s => s.questNpcPrograms);
  const targets = useMemo(() => getActiveQuestNavigationTargets({
    spellQuestAssignments,
    questFlags,
    questUnlockedSpells,
    questNpcPrograms,
  }), [questFlags, questNpcPrograms, questUnlockedSpells, spellQuestAssignments]);

  if (targets.length === 0) return null;

  return <ActiveQuestNavigationBeacons targets={targets} />;
}

function ActiveQuestNavigationBeacons({ targets }: { targets: QuestNavigationTarget[] }) {
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const lastMobileUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const beaconNodesRef = useRef(new Map<string, QuestBeaconNodes>());

  const registerNode = useCallback((targetId: string, nodeKey: QuestBeaconNodeKey, node: THREE.Object3D | null) => {
    const beaconNodes = beaconNodesRef.current;
    if (!node) {
      const existing = beaconNodes.get(targetId);
      if (existing) {
        delete existing[nodeKey];
        if (!existing.group && !existing.beam && !existing.ring) {
          beaconNodes.delete(targetId);
        }
      }
      return;
    }

    const existing = beaconNodes.get(targetId) ?? {};
    if (nodeKey === "group") {
      existing.group = node as THREE.Group;
    } else if (nodeKey === "beam") {
      existing.beam = node as THREE.Mesh;
    } else {
      existing.ring = node as THREE.Mesh;
    }
    beaconNodes.set(targetId, existing);
  }, []);

  useFrame((state) => {
    if (mobilePerformanceMode) {
      const now = state.clock.elapsedTime;
      if (now - lastMobileUpdateAtRef.current < MOBILE_QUEST_BEACON_UPDATE_INTERVAL_SECONDS) return;
      lastMobileUpdateAtRef.current = now;
    }

    const elapsed = state.clock.elapsedTime;
    for (const target of targets) {
      const nodes = beaconNodesRef.current.get(target.id);
      if (!nodes) continue;

      const pulse = 1 + Math.sin(elapsed * 2.8 + target.x * 0.01 + target.z * 0.01) * 0.08;
      nodes.group?.scale.setScalar(pulse);
      if (nodes.beam) {
        nodes.beam.rotation.y = elapsed * 0.45;
      }
      if (nodes.ring) {
        nodes.ring.rotation.z = elapsed * 0.9;
      }
    }
  });

  return (
    <group name="quest-navigation-beacons">
      {targets.map((target) => (
        <QuestNavigationBeacon key={target.id} target={target} registerNode={registerNode} />
      ))}
    </group>
  );
}
