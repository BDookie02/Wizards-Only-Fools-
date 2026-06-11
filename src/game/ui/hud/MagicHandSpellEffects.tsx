import { SpellType } from "../../../store/gameStore";
import { MeteorShowerCanvas, TornadoSpellCanvas } from "./magicHandAreaSpellEffects";
import { BuffSpellCanvas } from "./magicHandBuffSpellEffects";
import { DiscShieldCanvas, OrbShieldCanvas } from "./magicHandDefenseSpellEffects";
import { BlinkGifCanvas, PortalGifCanvas, SmokeBombGifCanvas } from "./magicHandGifSpellEffects";
import { LightningSpellCanvas } from "./magicHandLightningSpellEffect";
import {
  FireballCanvas,
  HealSpellCanvas,
  IceShardCanvas,
  IceSpellCanvas,
  RingsSpellCanvas,
} from "./magicHandSpriteSpellEffects";
import { KunaiCanvas, MagicGlassOrbCanvas } from "./magicHandThreeSpellEffects";
import { GrabSpellCanvas, HealingCrystalsCanvas } from "./magicHandUtilitySpellEffects";

export function MagicHandSpellEffectSlot({
  currentSpell,
  isChargingSpell,
  align,
}: {
  currentSpell: SpellType;
  isChargingSpell: boolean;
  align: "left" | "right";
}) {
  switch (currentSpell) {
    case "fireball":
    case "flamethrower":
      return <FireballCanvas isActive isCharging={isChargingSpell} />;
    case "iceshard":
      return !isChargingSpell ? <IceShardCanvas isActive isCharging={isChargingSpell} /> : null;
    case "icespell":
      return <IceSpellCanvas isActive isCharging={isChargingSpell} />;
    case "healspell":
      return <HealSpellCanvas isActive isCharging={isChargingSpell} />;
    case "ringsofpower":
      return <RingsSpellCanvas isActive isCharging={isChargingSpell} />;
    case "portal":
      return <PortalGifCanvas isActive isCharging={isChargingSpell} />;
    case "lightning":
      return <LightningSpellCanvas isActive isCharging={isChargingSpell} />;
    case "blink":
      return <BlinkGifCanvas isActive isCharging={isChargingSpell} />;
    case "grab":
      return !isChargingSpell ? <GrabSpellCanvas isActive isCharging={isChargingSpell} /> : null;
    case "tornado":
      return <TornadoSpellCanvas isActive isCharging={isChargingSpell} />;
    case "meteorshower":
      return <MeteorShowerCanvas isActive isCharging={isChargingSpell} />;
    case "smokebomb":
      return <SmokeBombGifCanvas isActive isCharging={isChargingSpell} />;
    case "discshield":
      return <DiscShieldCanvas isActive isCharging={isChargingSpell} />;
    case "orbshield":
      return <OrbShieldCanvas isActive isCharging={isChargingSpell} />;
    case "kunai":
      return <KunaiCanvas isActive isCharging={isChargingSpell} />;
    case "healingcrystals":
      return <HealingCrystalsCanvas isActive isCharging={isChargingSpell} />;
    case "magicarmor":
      return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="armor" />;
    case "jumpboost":
      return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="jump" />;
    case "speedboost":
      return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="speed" />;
    case "tungstonballsack":
      return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="tungston" />;
    case "sleep":
      return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="sleep" />;
    case "poison":
      return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="poison" />;
    case "acid":
      return <BuffSpellCanvas isActive isCharging={isChargingSpell} variant="acid" />;
    case "magicglassorb":
      return <MagicGlassOrbCanvas isActive isCharging={isChargingSpell} align={align} />;
    default:
      return null;
  }
}
