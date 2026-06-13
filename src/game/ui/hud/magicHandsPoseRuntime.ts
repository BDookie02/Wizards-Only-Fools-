import type { SpellType } from "../../../store/gameStore";

export type MagicHandSide = "left" | "right";

export type MagicHandPoseInput = {
  isMagicArmed: boolean;
  isSpellMenuOpen: boolean;
  leftRuneReady: boolean;
  rightRuneReady: boolean;
  leftSpell: SpellType;
  rightSpell: SpellType;
  isLeftCharging: boolean;
  isRightCharging: boolean;
  showLeftFiringPose: boolean;
  showRightFiringPose: boolean;
};

export type MagicHandPoseFlags = {
  leftFiringPoseActive: boolean;
  rightFiringPoseActive: boolean;
  leftUnpoweredPoseActive: boolean;
  rightUnpoweredPoseActive: boolean;
  leftHandUsesFiringSprite: boolean;
  rightHandUsesFiringSprite: boolean;
};

export function getMagicHandsAspectOffsetClass(aspectRatio: string) {
  switch (aspectRatio) {
    case "21/9":
      return "magic-hands-ultrawide-offset";
    case "4/3":
      return "magic-hands-classic-offset";
    case "Fill":
      return "magic-hands-fill-offset";
    default:
      return "";
  }
}

export function getMagicHandTranslate(usesFiringSprite: boolean, hand: MagicHandSide) {
  if (hand === "left") {
    return usesFiringSprite ? "-8%" : "-8.5%";
  }

  return usesFiringSprite ? "8%" : "8.5%";
}

export function resolveMagicHandPoseFlags(input: MagicHandPoseInput): MagicHandPoseFlags {
  const canShowHandPose = input.isMagicArmed && !input.isSpellMenuOpen;
  const leftFiringPoseActive =
    canShowHandPose &&
    input.leftRuneReady &&
    input.leftSpell !== "arcanebeam" &&
    (input.isLeftCharging || input.showLeftFiringPose);
  const rightFiringPoseActive =
    canShowHandPose &&
    input.rightRuneReady &&
    input.rightSpell !== "arcanebeam" &&
    (input.isRightCharging || input.showRightFiringPose);
  const leftUnpoweredPoseActive = canShowHandPose && !input.leftRuneReady;
  const rightUnpoweredPoseActive = canShowHandPose && !input.rightRuneReady;

  return {
    leftFiringPoseActive,
    rightFiringPoseActive,
    leftUnpoweredPoseActive,
    rightUnpoweredPoseActive,
    leftHandUsesFiringSprite: leftFiringPoseActive || leftUnpoweredPoseActive,
    rightHandUsesFiringSprite: rightFiringPoseActive || rightUnpoweredPoseActive,
  };
}
