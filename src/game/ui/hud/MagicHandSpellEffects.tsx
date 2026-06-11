import { lazy, Suspense } from "react";
import { SpellType } from "../../../store/gameStore";

const loadAreaSpellEffects = () => import("./magicHandAreaSpellEffects");
const loadBuffSpellEffects = () => import("./magicHandBuffSpellEffects");
const loadDefenseSpellEffects = () => import("./magicHandDefenseSpellEffects");
const loadGifSpellEffects = () => import("./magicHandGifSpellEffects");
const loadLightningSpellEffect = () => import("./magicHandLightningSpellEffect");
const loadSpriteSpellEffects = () => import("./magicHandSpriteSpellEffects");
const loadThreeSpellEffects = () => import("./magicHandThreeSpellEffects");
const loadUtilitySpellEffects = () => import("./magicHandUtilitySpellEffects");

const LazyMeteorShowerCanvas = lazy(() => loadAreaSpellEffects().then((module) => ({ default: module.MeteorShowerCanvas })));
const LazyTornadoSpellCanvas = lazy(() => loadAreaSpellEffects().then((module) => ({ default: module.TornadoSpellCanvas })));
const LazyBuffSpellCanvas = lazy(() => loadBuffSpellEffects().then((module) => ({ default: module.BuffSpellCanvas })));
const LazyDiscShieldCanvas = lazy(() => loadDefenseSpellEffects().then((module) => ({ default: module.DiscShieldCanvas })));
const LazyOrbShieldCanvas = lazy(() => loadDefenseSpellEffects().then((module) => ({ default: module.OrbShieldCanvas })));
const LazyBlinkGifCanvas = lazy(() => loadGifSpellEffects().then((module) => ({ default: module.BlinkGifCanvas })));
const LazyPortalGifCanvas = lazy(() => loadGifSpellEffects().then((module) => ({ default: module.PortalGifCanvas })));
const LazySmokeBombGifCanvas = lazy(() => loadGifSpellEffects().then((module) => ({ default: module.SmokeBombGifCanvas })));
const LazyLightningSpellCanvas = lazy(() => loadLightningSpellEffect().then((module) => ({ default: module.LightningSpellCanvas })));
const LazyFireballCanvas = lazy(() => loadSpriteSpellEffects().then((module) => ({ default: module.FireballCanvas })));
const LazyHealSpellCanvas = lazy(() => loadSpriteSpellEffects().then((module) => ({ default: module.HealSpellCanvas })));
const LazyIceShardCanvas = lazy(() => loadSpriteSpellEffects().then((module) => ({ default: module.IceShardCanvas })));
const LazyIceSpellCanvas = lazy(() => loadSpriteSpellEffects().then((module) => ({ default: module.IceSpellCanvas })));
const LazyRingsSpellCanvas = lazy(() => loadSpriteSpellEffects().then((module) => ({ default: module.RingsSpellCanvas })));
const LazyKunaiCanvas = lazy(() => loadThreeSpellEffects().then((module) => ({ default: module.KunaiCanvas })));
const LazyMagicGlassOrbCanvas = lazy(() => loadThreeSpellEffects().then((module) => ({ default: module.MagicGlassOrbCanvas })));
const LazyGrabSpellCanvas = lazy(() => loadUtilitySpellEffects().then((module) => ({ default: module.GrabSpellCanvas })));
const LazyHealingCrystalsCanvas = lazy(() => loadUtilitySpellEffects().then((module) => ({ default: module.HealingCrystalsCanvas })));

export function preloadMagicHandSpellEffect(currentSpell: SpellType) {
  switch (currentSpell) {
    case "tornado":
    case "meteorshower":
      void loadAreaSpellEffects();
      return;
    case "magicarmor":
    case "jumpboost":
    case "speedboost":
    case "tungstonballsack":
    case "sleep":
    case "poison":
    case "acid":
      void loadBuffSpellEffects();
      return;
    case "discshield":
    case "orbshield":
      void loadDefenseSpellEffects();
      return;
    case "portal":
    case "blink":
    case "smokebomb":
      void loadGifSpellEffects();
      return;
    case "lightning":
      void loadLightningSpellEffect();
      return;
    case "fireball":
    case "flamethrower":
    case "iceshard":
    case "icespell":
    case "healspell":
    case "ringsofpower":
      void loadSpriteSpellEffects();
      return;
    case "kunai":
    case "magicglassorb":
      void loadThreeSpellEffects();
      return;
    case "grab":
    case "healingcrystals":
      void loadUtilitySpellEffects();
      return;
    default:
      return;
  }
}

function MagicHandSpellEffect({
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
      return <LazyFireballCanvas isActive isCharging={isChargingSpell} />;
    case "iceshard":
      return !isChargingSpell ? <LazyIceShardCanvas isActive isCharging={isChargingSpell} /> : null;
    case "icespell":
      return <LazyIceSpellCanvas isActive isCharging={isChargingSpell} />;
    case "healspell":
      return <LazyHealSpellCanvas isActive isCharging={isChargingSpell} />;
    case "ringsofpower":
      return <LazyRingsSpellCanvas isActive isCharging={isChargingSpell} />;
    case "portal":
      return <LazyPortalGifCanvas isActive isCharging={isChargingSpell} />;
    case "lightning":
      return <LazyLightningSpellCanvas isActive isCharging={isChargingSpell} />;
    case "blink":
      return <LazyBlinkGifCanvas isActive isCharging={isChargingSpell} />;
    case "grab":
      return !isChargingSpell ? <LazyGrabSpellCanvas isActive isCharging={isChargingSpell} /> : null;
    case "tornado":
      return <LazyTornadoSpellCanvas isActive isCharging={isChargingSpell} />;
    case "meteorshower":
      return <LazyMeteorShowerCanvas isActive isCharging={isChargingSpell} />;
    case "smokebomb":
      return <LazySmokeBombGifCanvas isActive isCharging={isChargingSpell} />;
    case "discshield":
      return <LazyDiscShieldCanvas isActive isCharging={isChargingSpell} />;
    case "orbshield":
      return <LazyOrbShieldCanvas isActive isCharging={isChargingSpell} />;
    case "kunai":
      return <LazyKunaiCanvas isActive isCharging={isChargingSpell} />;
    case "healingcrystals":
      return <LazyHealingCrystalsCanvas isActive isCharging={isChargingSpell} />;
    case "magicarmor":
      return <LazyBuffSpellCanvas isActive isCharging={isChargingSpell} variant="armor" />;
    case "jumpboost":
      return <LazyBuffSpellCanvas isActive isCharging={isChargingSpell} variant="jump" />;
    case "speedboost":
      return <LazyBuffSpellCanvas isActive isCharging={isChargingSpell} variant="speed" />;
    case "tungstonballsack":
      return <LazyBuffSpellCanvas isActive isCharging={isChargingSpell} variant="tungston" />;
    case "sleep":
      return <LazyBuffSpellCanvas isActive isCharging={isChargingSpell} variant="sleep" />;
    case "poison":
      return <LazyBuffSpellCanvas isActive isCharging={isChargingSpell} variant="poison" />;
    case "acid":
      return <LazyBuffSpellCanvas isActive isCharging={isChargingSpell} variant="acid" />;
    case "magicglassorb":
      return <LazyMagicGlassOrbCanvas isActive isCharging={isChargingSpell} align={align} />;
    default:
      return null;
  }
}

export function MagicHandSpellEffectSlot(props: {
  currentSpell: SpellType;
  isChargingSpell: boolean;
  align: "left" | "right";
}) {
  return (
    <Suspense fallback={null}>
      <MagicHandSpellEffect {...props} />
    </Suspense>
  );
}
