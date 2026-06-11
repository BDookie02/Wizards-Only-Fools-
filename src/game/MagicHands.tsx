import { useEffect } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { SpellType, useGameStore } from "../store/gameStore";
import { getSpriteUrl } from "./SpriteManifest";
import { ImageHandCanvas } from "./ui/hud/MagicHandSpriteCanvas";
import { MagicHandSpellEffectSlot, preloadMagicHandSpellEffect } from "./ui/hud/MagicHandSpellEffects";
import { useMagicHandsPose } from "./ui/hud/useMagicHandsPose";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function MagicHandsContent({
  playerState,
  currentSpell,
  frame,
  isChargingSpell,
  align,
  showFiringPose,
  showSpellEffects,
}: {
  playerState: any,
  currentSpell: SpellType,
  frame: number,
  isChargingSpell: boolean,
  align: 'left' | 'right',
  showFiringPose: boolean,
  showSpellEffects: boolean,
}) {
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);
  const shouldMirrorLeftHand = align === 'left' && showFiringPose && !isSpellMenuOpen;
  const shouldMirrorRightHand = align === 'right' && !showFiringPose;
  const shouldPutSpellsBehindHand = showSpellEffects && showFiringPose && !isSpellMenuOpen;
  const spellEffects = (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        transform: align === 'right' ? 'scaleX(-1)' : undefined,
        transformOrigin: 'center',
        zIndex: shouldPutSpellsBehindHand ? 1 : 3,
      }}
    >
      <MagicHandSpellEffectSlot
        currentSpell={currentSpell}
        isChargingSpell={isChargingSpell}
        align={align}
      />
    </div>
  );
  
  return (
    <div className={cn(
      "absolute inset-0 pointer-events-none transition-transform duration-200",
      playerState.isSliding ? "translate-y-16" :
      playerState.isCrouching ? "translate-y-10" :
      (playerState.isGrounded && playerState.isSprinting) ? "animate-bob-sprint" : 
      (playerState.isGrounded && playerState.isMoving) ? "animate-bob-walk" : ""
    )}>
      <div className="absolute inset-0">
        {showSpellEffects && !isSpellMenuOpen && shouldPutSpellsBehindHand && spellEffects}
        <ImageHandCanvas
          imageSrc={getSpriteUrl(`/sprites/misc/idle_${frame}.png`) || `/sprites/misc/idle_${frame}.png`}
          side={align}
          mirrorRightToLeft={shouldMirrorLeftHand}
          mirrorLeftToRight={shouldMirrorRightHand}
          poseScale={showFiringPose ? 0.76 : 1}
        />
        
        {showSpellEffects && !isSpellMenuOpen && !shouldPutSpellsBehindHand && spellEffects}
      </div>
    </div>
  );
}

function ActiveMagicHands({ playerState, leftSpell, rightSpell }: { playerState: any, leftSpell: SpellType, rightSpell: SpellType }) {
  const {
    frame,
    isLeftCharging,
    isRightCharging,
    leftRuneReady,
    rightRuneReady,
    leftHandUsesFiringSprite,
    rightHandUsesFiringSprite,
    leftHandTranslate,
    rightHandTranslate,
    aspectOffsetClass,
  } = useMagicHandsPose(leftSpell, rightSpell);

  const handsLayer = (
    <>
      {/* Left Half (Left Hand & Spells) */}
      <div data-wof-hud-qa="magic-hand-left" className="magic-hand-mask magic-hand-mask-left absolute top-0 left-0 w-1/2 h-full overflow-hidden pointer-events-none z-[60]">
        <div className="magic-hands-frame magic-hands-frame-left absolute top-0 left-0 h-full aspect-video" style={{ transform: `translateX(calc(${leftHandTranslate} + var(--magic-hands-left-x-nudge, 0%)))` }}>
          <MagicHandsContent playerState={playerState} currentSpell={leftSpell} frame={frame} isChargingSpell={leftRuneReady && isLeftCharging} align="left" showFiringPose={leftHandUsesFiringSprite} showSpellEffects={leftRuneReady} />
        </div>
      </div>
      
      {/* Right Half (Right Hand) */}
      <div data-wof-hud-qa="magic-hand-right" className="magic-hand-mask magic-hand-mask-right absolute top-0 right-0 w-1/2 h-full overflow-hidden pointer-events-none z-[60]">
        <div className="magic-hands-frame magic-hands-frame-right absolute top-0 right-0 h-full aspect-video" style={{ transform: `translateX(calc(${rightHandTranslate} + var(--magic-hands-right-x-nudge, 0%)))`, transformOrigin: 'bottom right' }}>
          <MagicHandsContent playerState={playerState} currentSpell={rightSpell} frame={frame} isChargingSpell={rightRuneReady && isRightCharging} align="right" showFiringPose={rightHandUsesFiringSprite} showSpellEffects={rightRuneReady} />
        </div>
      </div>
    </>
  );

  return (
    <div data-wof-hud-qa="magic-hands" className={cn("absolute inset-0 pointer-events-none transition-transform duration-200 z-40", aspectOffsetClass)}>
      {handsLayer}
    </div>
  );
}

// ============== MAIN COMPONENT ============== //
export function MagicHands({ playerState, leftSpell, rightSpell }: { playerState: any, leftSpell: SpellType, rightSpell: SpellType }) {
  const isMagicArmed = useGameStore(s => s.isMagicArmed);
  const isSpellMenuOpen = useGameStore(s => s.isSpellMenuOpen);

  useEffect(() => {
    if (!isMagicArmed) return;
    preloadMagicHandSpellEffect(leftSpell);
    preloadMagicHandSpellEffect(rightSpell);
  }, [isMagicArmed, leftSpell, rightSpell]);

  if (isSpellMenuOpen || playerState.isMeditating || !isMagicArmed) {
    return null;
  }

  return <ActiveMagicHands playerState={playerState} leftSpell={leftSpell} rightSpell={rightSpell} />;
}
