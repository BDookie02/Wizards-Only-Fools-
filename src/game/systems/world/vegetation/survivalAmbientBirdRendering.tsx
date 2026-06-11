import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSurvivalFeatureCount } from "../../../tools/qa/survivalFeatureCounters";
import { isMobilePerformanceMode } from "../../input/performanceMode";
import type { SurvivalChunkInfo } from "../survival/survivalWorldConfig";
import {
  makeSurvivalAmbientBirdFlock,
  type SurvivalAmbientBird,
  type SurvivalAmbientBirdSpecies,
} from "./survivalAmbientBirds";

type SurvivalAmbientBirdSpeciesGroup = {
  key: string;
  species: SurvivalAmbientBirdSpecies;
  birds: SurvivalAmbientBird[];
};

const MOBILE_AMBIENT_BIRD_UPDATE_INTERVAL_SECONDS = 1 / 24;

const ambientBirdBodyGeometries = new Map<string, THREE.ConeGeometry>();
const ambientBirdWingGeometries = new Map<string, THREE.PlaneGeometry>();
const ambientBirdTailGeometries = new Map<string, THREE.ConeGeometry>();
const ambientBirdBodyMaterials = new Map<string, THREE.MeshBasicMaterial>();
const ambientBirdWingMaterials = new Map<string, THREE.MeshBasicMaterial>();
const ambientBirdTailMaterials = new Map<string, THREE.MeshBasicMaterial>();

function getAmbientBirdBodyGeometry(species: SurvivalAmbientBirdSpecies) {
  const key = `${species.name}:body:${species.bodyLength}`;
  let geometry = ambientBirdBodyGeometries.get(key);
  if (!geometry) {
    geometry = new THREE.ConeGeometry(0.45, species.bodyLength, 5);
    ambientBirdBodyGeometries.set(key, geometry);
  }
  return geometry;
}

function getAmbientBirdWingGeometry(species: SurvivalAmbientBirdSpecies, wingHeight: number) {
  const key = `${species.name}:wing:${species.wingLength}:${wingHeight}`;
  let geometry = ambientBirdWingGeometries.get(key);
  if (!geometry) {
    geometry = new THREE.PlaneGeometry(species.wingLength, wingHeight);
    ambientBirdWingGeometries.set(key, geometry);
  }
  return geometry;
}

function getAmbientBirdTailGeometry(species: SurvivalAmbientBirdSpecies, tailRadius: number, tailLength: number) {
  const key = `${species.name}:tail:${tailRadius}:${tailLength}`;
  let geometry = ambientBirdTailGeometries.get(key);
  if (!geometry) {
    geometry = new THREE.ConeGeometry(tailRadius, tailLength, 4);
    ambientBirdTailGeometries.set(key, geometry);
  }
  return geometry;
}

function getAmbientBirdBodyMaterial(species: SurvivalAmbientBirdSpecies) {
  let material = ambientBirdBodyMaterials.get(species.name);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color: species.body, toneMapped: false });
    ambientBirdBodyMaterials.set(species.name, material);
  }
  return material;
}

function getAmbientBirdWingMaterial(species: SurvivalAmbientBirdSpecies) {
  let material = ambientBirdWingMaterials.get(species.name);
  if (!material) {
    material = new THREE.MeshBasicMaterial({
      color: species.wing,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.86,
      depthWrite: false,
      toneMapped: false,
    });
    ambientBirdWingMaterials.set(species.name, material);
  }
  return material;
}

function getAmbientBirdTailMaterial(species: SurvivalAmbientBirdSpecies) {
  let material = ambientBirdTailMaterials.get(species.name);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color: species.accent, toneMapped: false });
    ambientBirdTailMaterials.set(species.name, material);
  }
  return material;
}

function makeBirdSpeciesGroups(birds: SurvivalAmbientBird[]) {
  const groups: SurvivalAmbientBirdSpeciesGroup[] = [];

  for (const bird of birds) {
    let group: SurvivalAmbientBirdSpeciesGroup | null = null;
    for (let index = 0; index < groups.length; index += 1) {
      if (groups[index].species === bird.species) {
        group = groups[index];
        break;
      }
    }
    if (!group) {
      group = {
        key: bird.species.name,
        species: bird.species,
        birds: [],
      };
      groups.push(group);
    }
    group.birds.push(bird);
  }

  return groups;
}

function AmbientBirdSpeciesInstances({
  group,
}: {
  group: SurvivalAmbientBirdSpeciesGroup;
}) {
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const leftWingRef = useRef<THREE.InstancedMesh>(null);
  const rightWingRef = useRef<THREE.InstancedMesh>(null);
  const tailRef = useRef<THREE.InstancedMesh>(null);
  const parent = useMemo(() => new THREE.Object3D(), []);
  const child = useMemo(() => new THREE.Object3D(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const { birds, species } = group;
  const capacity = Math.max(1, birds.length);
  const wingHeight = species.name === "moth" ? 0.9 : 0.48;
  const tailRadius = species.name === "toucan" ? 0.28 : 0.16;
  const tailLength = species.name === "toucan" ? 1.05 : 0.62;
  const bodyGeometry = getAmbientBirdBodyGeometry(species);
  const wingGeometry = getAmbientBirdWingGeometry(species, wingHeight);
  const tailGeometry = getAmbientBirdTailGeometry(species, tailRadius, tailLength);
  const bodyMaterial = getAmbientBirdBodyMaterial(species);
  const wingMaterial = getAmbientBirdWingMaterial(species);
  const tailMaterial = getAmbientBirdTailMaterial(species);

  useLayoutEffect(() => {
    const uploadPart = (
      mesh: THREE.InstancedMesh | null,
      applyLocalTransform: (bird: SurvivalAmbientBird) => void,
    ) => {
      if (!mesh) return;
      mesh.count = birds.length;
      for (let index = 0; index < birds.length; index += 1) {
        const bird = birds[index];
        parent.position.set(bird.x, bird.y, bird.z);
        parent.rotation.set(0, bird.tilt, 0);
        parent.scale.setScalar(bird.scale);
        parent.updateMatrix();
        applyLocalTransform(bird);
        child.updateMatrix();
        matrix.multiplyMatrices(parent.matrix, child.matrix);
        mesh.setMatrixAt(index, matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.frustumCulled = false;
    };

    uploadPart(bodyRef.current, () => {
      child.position.set(0, 0, 0);
      child.rotation.set(0, 0, Math.PI / 2);
      child.scale.setScalar(1);
    });
    uploadPart(leftWingRef.current, (bird) => {
      child.position.set(-species.wingLength * 0.45, 0, 0);
      child.rotation.set(0, 0.1, 0.22 + Math.sin(bird.wingPhase) * 0.08);
      child.scale.setScalar(1);
    });
    uploadPart(rightWingRef.current, (bird) => {
      child.position.set(species.wingLength * 0.45, 0, 0);
      child.rotation.set(0, -0.1, -0.22 - Math.sin(bird.wingPhase) * 0.08);
      child.scale.setScalar(1);
    });
    uploadPart(tailRef.current, () => {
      child.position.set(0, -0.02, -0.92);
      child.rotation.set(Math.PI / 2, 0, 0);
      child.scale.setScalar(1);
    });
  }, [birds, child, matrix, parent, species.wingLength]);

  return (
    <group name={`survival-bird-species-${group.key}`}>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, capacity]} castShadow={false} frustumCulled={false}>
        <primitive attach="geometry" object={bodyGeometry} />
        <primitive attach="material" object={bodyMaterial} />
      </instancedMesh>
      <instancedMesh ref={leftWingRef} args={[undefined, undefined, capacity]} castShadow={false} frustumCulled={false}>
        <primitive attach="geometry" object={wingGeometry} />
        <primitive attach="material" object={wingMaterial} />
      </instancedMesh>
      <instancedMesh ref={rightWingRef} args={[undefined, undefined, capacity]} castShadow={false} frustumCulled={false}>
        <primitive attach="geometry" object={wingGeometry} />
        <primitive attach="material" object={wingMaterial} />
      </instancedMesh>
      <instancedMesh ref={tailRef} args={[undefined, undefined, capacity]} castShadow={false} frustumCulled={false}>
        <primitive attach="geometry" object={tailGeometry} />
        <primitive attach="material" object={tailMaterial} />
      </instancedMesh>
    </group>
  );
}

export function SurvivalBirdFlock({ chunk }: { chunk: SurvivalChunkInfo }) {
  const flockRef = useRef<THREE.Group>(null);
  const lastMobileUpdateAtRef = useRef(Number.NEGATIVE_INFINITY);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const { seed, baseY: flockBaseY, birds } = useMemo(() => makeSurvivalAmbientBirdFlock(chunk), [chunk]);
  const speciesGroups = useMemo(() => makeBirdSpeciesGroups(birds), [birds]);

  useSurvivalFeatureCount("ambientBirds", chunk.key, birds.length);

  useFrame((state) => {
    if (!flockRef.current) return;
    const elapsed = state.clock.elapsedTime;
    if (mobilePerformanceMode && elapsed - lastMobileUpdateAtRef.current < MOBILE_AMBIENT_BIRD_UPDATE_INTERVAL_SECONDS) return;
    lastMobileUpdateAtRef.current = elapsed;

    flockRef.current.rotation.y = seed * Math.PI * 2 + elapsed * (chunk.biome === "desert" ? 0.08 : 0.12);
    flockRef.current.position.y = flockBaseY + Math.sin(elapsed * 0.45 + seed * 3) * 8;
  });

  return (
    <group ref={flockRef} name={`survival-bird-flock-${chunk.key}`} position={[chunk.x, flockBaseY, chunk.z]}>
      {speciesGroups.map((group) => <AmbientBirdSpeciesInstances key={group.key} group={group} />)}
    </group>
  );
}
