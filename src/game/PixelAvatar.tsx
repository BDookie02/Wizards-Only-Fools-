import { useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { CharacterCustomization } from "../store/gameStore";
import {
  AVATAR_ALPHA_TEST,
  AVATAR_WORLD_CENTER_Y,
  AVATAR_WORLD_HEIGHT,
  AVATAR_WORLD_WIDTH,
  createAvatarTexture,
  getAvatarDirection,
  getFrameDelay,
  normalizeCharacterCustomization,
} from "./systems/rendering/avatar/avatarTextureFactory";
import { getNextAvatarFrameTick } from "./systems/rendering/avatar/avatarAnimationRuntime";
import { isMobilePerformanceMode } from "./systems/input/performanceMode";

const MOBILE_AVATAR_DIRECTION_UPDATE_MS = 160;
const AVATAR_BLINK_DELAY_BASE_MS = 2400;
const AVATAR_BLINK_DELAY_RANDOM_MS = 5200;
const AVATAR_BLINK_DURATION_BASE_MS = 95;
const AVATAR_BLINK_DURATION_RANDOM_MS = 70;

export {
  AVATAR_CANVAS_SIZE,
  NPC_AVATAR_GROUND_LIFT,
  NPC_AVATAR_SCALE,
  drawPixelAvatarFrame,
  normalizeCharacterCustomization,
} from "./systems/rendering/avatar/avatarTextureFactory";

type AvatarBillboardRuntimeProps = {
  blinkEndAtRef: MutableRefObject<number | null>;
  blinkStartAtRef: MutableRefObject<number | null>;
  directionLocked: boolean;
  effectiveDirectionUpdateMs: number;
  frameDelayMs: number;
  frameRef: MutableRefObject<number>;
  isBlinkingRef: MutableRefObject<boolean>;
  lastDirectionCheckRef: MutableRefObject<number>;
  lastDirectionRef: MutableRefObject<number>;
  lastFrameAdvanceAtRef: MutableRefObject<number | null>;
  setIsBlinking: Dispatch<SetStateAction<boolean>>;
  setDirection: Dispatch<SetStateAction<number>>;
  setFrame: Dispatch<SetStateAction<number>>;
  spriteRef: MutableRefObject<THREE.Sprite | null>;
  staticFrame: boolean;
  worldPositionRef: MutableRefObject<THREE.Vector3>;
  yaw: number;
};

function AvatarBillboardRuntime({
  blinkEndAtRef,
  blinkStartAtRef,
  directionLocked,
  effectiveDirectionUpdateMs,
  frameDelayMs,
  frameRef,
  isBlinkingRef,
  lastDirectionCheckRef,
  lastDirectionRef,
  lastFrameAdvanceAtRef,
  setIsBlinking,
  setDirection,
  setFrame,
  spriteRef,
  staticFrame,
  worldPositionRef,
  yaw,
}: AvatarBillboardRuntimeProps) {
  useFrame(({ camera, clock }) => {
    const now = clock.elapsedTime * 1000;
    if (!staticFrame) {
      const nextFrame = getNextAvatarFrameTick({
        nowMs: now,
        lastFrameAtMs: lastFrameAdvanceAtRef.current,
        frame: frameRef.current,
        frameDelayMs,
      });
      lastFrameAdvanceAtRef.current = nextFrame.lastFrameAtMs;
      if (nextFrame.advanced && nextFrame.frame !== frameRef.current) {
        frameRef.current = nextFrame.frame;
        setFrame(nextFrame.frame);
      }

      if (blinkStartAtRef.current === null || !Number.isFinite(blinkStartAtRef.current)) {
        blinkStartAtRef.current = now + AVATAR_BLINK_DELAY_BASE_MS + Math.random() * AVATAR_BLINK_DELAY_RANDOM_MS;
      }

      if (!isBlinkingRef.current && now >= blinkStartAtRef.current) {
        isBlinkingRef.current = true;
        blinkEndAtRef.current = now + AVATAR_BLINK_DURATION_BASE_MS + Math.random() * AVATAR_BLINK_DURATION_RANDOM_MS;
        setIsBlinking(true);
      } else if (
        isBlinkingRef.current &&
        blinkEndAtRef.current !== null &&
        now >= blinkEndAtRef.current
      ) {
        isBlinkingRef.current = false;
        blinkEndAtRef.current = null;
        blinkStartAtRef.current = now + AVATAR_BLINK_DELAY_BASE_MS + Math.random() * AVATAR_BLINK_DELAY_RANDOM_MS;
        setIsBlinking(false);
      }
    }

    const sprite = spriteRef.current;
    if (!sprite) return;
    if (directionLocked) return;
    if (effectiveDirectionUpdateMs > 0) {
      if (now - lastDirectionCheckRef.current < effectiveDirectionUpdateMs) return;
      lastDirectionCheckRef.current = now;
    }

    sprite.getWorldPosition(worldPositionRef.current);
    const nextDirection = getAvatarDirection(yaw, worldPositionRef.current, camera);
    if (nextDirection !== lastDirectionRef.current) {
      lastDirectionRef.current = nextDirection;
      setDirection(nextDirection);
    }
  });

  return null;
}

export function AvatarBillboard({
  character,
  animation = "idle",
  yaw = 0,
  health = 100,
  isSpeaking = false,
  pose = "standing",
  staticFrame = false,
  directionUpdateMs = 90,
  fixedDirection,
}: {
  character?: Partial<CharacterCustomization>;
  animation?: string;
  yaw?: number;
  health?: number;
  isSpeaking?: boolean;
  pose?: "standing" | "floor";
  staticFrame?: boolean;
  directionUpdateMs?: number;
  fixedDirection?: number;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const [frame, setFrame] = useState(0);
  const [direction, setDirection] = useState(() => (
    typeof fixedDirection === "number" ? THREE.MathUtils.euclideanModulo(Math.round(fixedDirection), 8) : 0
  ));
  const [isBlinking, setIsBlinking] = useState(false);
  const frameRef = useRef(0);
  const lastFrameAdvanceAtRef = useRef<number | null>(null);
  const worldPositionRef = useRef(new THREE.Vector3());
  const lastDirectionRef = useRef(0);
  const lastDirectionCheckRef = useRef(0);
  const blinkStartAtRef = useRef<number | null>(null);
  const blinkEndAtRef = useRef<number | null>(null);
  const isBlinkingRef = useRef(false);
  const mobilePerformanceMode = useMemo(() => isMobilePerformanceMode(), []);
  const displayAnimation = health <= 0 ? "damaged" : animation;
  const frameDelayMs = getFrameDelay(displayAnimation, isSpeaking);
  const effectiveDirectionUpdateMs = mobilePerformanceMode
    ? Math.max(directionUpdateMs, MOBILE_AVATAR_DIRECTION_UPDATE_MS)
    : directionUpdateMs;
  const directionLocked = typeof fixedDirection === "number";
  const normalizedCharacter = useMemo(() => normalizeCharacterCustomization(character), [character]);

  useEffect(() => {
    if (typeof fixedDirection !== "number") return;
    const normalizedDirection = THREE.MathUtils.euclideanModulo(Math.round(fixedDirection), 8);
    if (normalizedDirection !== lastDirectionRef.current) {
      lastDirectionRef.current = normalizedDirection;
      setDirection(normalizedDirection);
    }
  }, [fixedDirection]);

  useEffect(() => {
    lastFrameAdvanceAtRef.current = null;
    if (staticFrame) {
      frameRef.current = 0;
      setFrame((current) => (current === 0 ? current : 0));
    }
  }, [displayAnimation, isSpeaking, staticFrame]);

  useEffect(() => {
    blinkStartAtRef.current = null;
    blinkEndAtRef.current = null;
    isBlinkingRef.current = false;
    setIsBlinking(false);
  }, [staticFrame]);

  const texture = useMemo(
    () => createAvatarTexture(normalizedCharacter, displayAnimation, pose === "floor" ? 0 : direction, frame, isSpeaking, isBlinking),
    [direction, displayAnimation, frame, isBlinking, isSpeaking, normalizedCharacter, pose],
  );
  const shouldMountRuntime = !staticFrame || !directionLocked;

  if (pose === "floor") {
    return (
      <>
        {shouldMountRuntime && (
          <AvatarBillboardRuntime
            blinkEndAtRef={blinkEndAtRef}
            blinkStartAtRef={blinkStartAtRef}
            directionLocked={directionLocked}
            effectiveDirectionUpdateMs={effectiveDirectionUpdateMs}
            frameDelayMs={frameDelayMs}
            frameRef={frameRef}
            isBlinkingRef={isBlinkingRef}
            lastDirectionCheckRef={lastDirectionCheckRef}
            lastDirectionRef={lastDirectionRef}
            lastFrameAdvanceAtRef={lastFrameAdvanceAtRef}
            setIsBlinking={setIsBlinking}
            setDirection={setDirection}
            setFrame={setFrame}
            spriteRef={spriteRef}
            staticFrame={staticFrame}
            worldPositionRef={worldPositionRef}
            yaw={yaw}
          />
        )}
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[AVATAR_WORLD_WIDTH * 0.9, AVATAR_WORLD_HEIGHT * 0.9, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={texture} transparent alphaTest={AVATAR_ALPHA_TEST} depthWrite toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      </>
    );
  }

  return (
    <>
      {shouldMountRuntime && (
        <AvatarBillboardRuntime
          blinkEndAtRef={blinkEndAtRef}
          blinkStartAtRef={blinkStartAtRef}
          directionLocked={directionLocked}
          effectiveDirectionUpdateMs={effectiveDirectionUpdateMs}
          frameDelayMs={frameDelayMs}
          frameRef={frameRef}
          isBlinkingRef={isBlinkingRef}
          lastDirectionCheckRef={lastDirectionCheckRef}
          lastDirectionRef={lastDirectionRef}
          lastFrameAdvanceAtRef={lastFrameAdvanceAtRef}
          setIsBlinking={setIsBlinking}
          setDirection={setDirection}
          setFrame={setFrame}
          spriteRef={spriteRef}
          staticFrame={staticFrame}
          worldPositionRef={worldPositionRef}
          yaw={yaw}
        />
      )}
      <sprite ref={spriteRef} position={[0, AVATAR_WORLD_CENTER_Y, 0]} scale={[AVATAR_WORLD_WIDTH, AVATAR_WORLD_HEIGHT, 1]}>
        <spriteMaterial map={texture} transparent alphaTest={AVATAR_ALPHA_TEST} depthWrite toneMapped={false} />
      </sprite>
    </>
  );
}

export function AvatarWorldFacingPlane({
  character,
  animation = "idle",
  yaw = 0,
  health = 100,
}: {
  character?: Partial<CharacterCustomization>;
  animation?: string;
  yaw?: number;
  health?: number;
}) {
  const displayAnimation = health <= 0 ? "damaged" : animation;
  const normalizedCharacter = useMemo(() => normalizeCharacterCustomization(character), [character]);
  const frontTexture = useMemo(
    () => createAvatarTexture(normalizedCharacter, displayAnimation, 0, 0),
    [displayAnimation, normalizedCharacter],
  );
  const backTexture = useMemo(
    () => createAvatarTexture(normalizedCharacter, displayAnimation, 4, 0),
    [displayAnimation, normalizedCharacter],
  );

  return (
    <group position={[0, AVATAR_WORLD_CENTER_Y, 0]} rotation={[0, Math.PI - yaw, 0]} scale={[AVATAR_WORLD_WIDTH, AVATAR_WORLD_HEIGHT, 1]}>
      <mesh position={[0, 0, 0.012]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={frontTexture} transparent alphaTest={AVATAR_ALPHA_TEST} depthWrite toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, -0.012]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={backTexture} transparent alphaTest={AVATAR_ALPHA_TEST} depthWrite toneMapped={false} />
      </mesh>
    </group>
  );
}
