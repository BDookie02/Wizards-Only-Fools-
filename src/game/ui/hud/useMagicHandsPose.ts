import { useEffect, useRef, useState } from "react";
import { type SpellType, hasRunePower, useGameStore } from "../../../store/gameStore";
import { getMagicHandFrameStyle, getMagicHandsAspectOffsetClass, resolveMagicHandPoseFlags } from "./magicHandsPoseRuntime";
import { useLoopedFrameTimer } from "./useLoopedFrameTimer";

export function useMagicHandsPose(leftSpell: SpellType, rightSpell: SpellType) {
  const isChargingSpell = useGameStore(s => s.isChargingSpell);
  const chargingHand = useGameStore(s => s.chargingHand);
  const chargingHands = useGameStore(s => s.chargingHands);
  const aspectRatio = useGameStore(s => s.aspectRatio);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const isMagicArmed = useGameStore(s => s.isMagicArmed);
  const leftRunePower = useGameStore(s => s.leftRunePower);
  const rightRunePower = useGameStore(s => s.rightRunePower);
  const [showLeftFiringPose, setShowLeftFiringPose] = useState(false);
  const [showRightFiringPose, setShowRightFiringPose] = useState(false);
  const leftFiringPoseTimeoutRef = useRef<number | null>(null);
  const rightFiringPoseTimeoutRef = useRef<number | null>(null);
  const totalFrames = 4;
  const isLeftCharging = chargingHands.left || (isChargingSpell && chargingHand === "left");
  const isRightCharging = chargingHands.right || (isChargingSpell && chargingHand === "right");
  const leftRuneReady = hasRunePower(leftRunePower);
  const rightRuneReady = hasRunePower(rightRunePower);
  const shouldAnimateHands = isMagicArmed && !isSpellMenuOpen;
  const frame = useLoopedFrameTimer({
    frameCount: totalFrames,
    intervalMs: 200,
    firstFrame: 1,
    isRunning: shouldAnimateHands,
  });

  useEffect(() => {
    if (leftFiringPoseTimeoutRef.current !== null) {
      window.clearTimeout(leftFiringPoseTimeoutRef.current);
      leftFiringPoseTimeoutRef.current = null;
    }

    if (!isMagicArmed || isSpellMenuOpen || leftSpell === "arcanebeam") {
      setShowLeftFiringPose(false);
      return;
    }

    if (isLeftCharging) {
      setShowLeftFiringPose(true);
      return;
    }

    if (showLeftFiringPose) {
      leftFiringPoseTimeoutRef.current = window.setTimeout(() => {
        setShowLeftFiringPose(false);
        leftFiringPoseTimeoutRef.current = null;
      }, 140);
    }
  }, [isMagicArmed, leftSpell, isLeftCharging, isSpellMenuOpen, showLeftFiringPose]);

  useEffect(() => {
    if (rightFiringPoseTimeoutRef.current !== null) {
      window.clearTimeout(rightFiringPoseTimeoutRef.current);
      rightFiringPoseTimeoutRef.current = null;
    }

    if (!isMagicArmed || isSpellMenuOpen || rightSpell === "arcanebeam") {
      setShowRightFiringPose(false);
      return;
    }

    if (isRightCharging) {
      setShowRightFiringPose(true);
      return;
    }

    if (showRightFiringPose) {
      rightFiringPoseTimeoutRef.current = window.setTimeout(() => {
        setShowRightFiringPose(false);
        rightFiringPoseTimeoutRef.current = null;
      }, 140);
    }
  }, [isMagicArmed, rightSpell, isRightCharging, isSpellMenuOpen, showRightFiringPose]);

  useEffect(() => () => {
    if (leftFiringPoseTimeoutRef.current !== null) {
      window.clearTimeout(leftFiringPoseTimeoutRef.current);
    }
    if (rightFiringPoseTimeoutRef.current !== null) {
      window.clearTimeout(rightFiringPoseTimeoutRef.current);
    }
  }, []);

  const { leftHandUsesFiringSprite, rightHandUsesFiringSprite } = resolveMagicHandPoseFlags({
    isMagicArmed,
    isSpellMenuOpen,
    leftRuneReady,
    rightRuneReady,
    leftSpell,
    rightSpell,
    isLeftCharging,
    isRightCharging,
    showLeftFiringPose,
    showRightFiringPose,
  });
  const aspectOffsetClass = getMagicHandsAspectOffsetClass(aspectRatio);

  return {
    frame,
    isMagicArmed,
    isSpellMenuOpen,
    isLeftCharging,
    isRightCharging,
    leftRuneReady,
    rightRuneReady,
    leftHandUsesFiringSprite,
    rightHandUsesFiringSprite,
    leftHandFrameStyle: getMagicHandFrameStyle(leftHandUsesFiringSprite, "left"),
    rightHandFrameStyle: getMagicHandFrameStyle(rightHandUsesFiringSprite, "right"),
    aspectOffsetClass,
  };
}
