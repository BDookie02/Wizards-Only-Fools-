import type { ReactNode } from "react";
import { useGameStore } from "../store/gameStore";
import type { Projectile } from "../store/gameStore";
import {
  ActivePortals,
  BlinkSpell,
  PortalSpell,
} from "./systems/spells/spellPortalTraversal";
import {
  DiscShield,
  OrbShield,
} from "./systems/spells/spellShieldRendering";
import { GrabSpell } from "./systems/spells/spellGrabRendering";
import { TornadoSpell, MeteorShowerSpell } from "./systems/spells/spellAreaEffects";
import { SmokeBomb } from "./systems/spells/spellSmokeRendering";
import { HealingCrystals } from "./systems/spells/spellHealingRendering";
import {
  Fireball,
  FlamethrowerParticle,
  IceSpell,
  Kunai,
  Lightning,
  PhaseBeam,
  RingsOfPower,
  StatusBolt,
} from "./systems/spells/spellDirectProjectiles";

function renderProjectile(projectile: Projectile): ReactNode {
  switch (projectile.type) {
    case 'fireball': return <Fireball key={projectile.id} projectile={projectile} />;
    case 'iceshard': return <PhaseBeam key={projectile.id} projectile={projectile} />;
    case 'arcanebeam': return <PhaseBeam key={projectile.id} projectile={projectile} />;
    case 'icespell': return <IceSpell key={projectile.id} projectile={projectile} />;
    case 'ringsofpower': return <RingsOfPower key={projectile.id} projectile={projectile} />;
    case 'lightning': return <Lightning key={projectile.id} projectile={projectile} />;
    case 'portal': return <PortalSpell key={projectile.id} projectile={projectile} />;
    case 'blink': return <BlinkSpell key={projectile.id} projectile={projectile} />;
    case 'grab': return <GrabSpell key={projectile.id} projectile={projectile} />;
    case 'tornado': return <TornadoSpell key={projectile.id} projectile={projectile} />;
    case 'meteorshower': return <MeteorShowerSpell key={projectile.id} projectile={projectile} />;
    case 'smokebomb': return <SmokeBomb key={projectile.id} projectile={projectile} />;
    case 'flamethrower': return <FlamethrowerParticle key={projectile.id} projectile={projectile} />;
    case 'discshield': return <DiscShield key={projectile.id} projectile={projectile} />;
    case 'orbshield': return <OrbShield key={projectile.id} projectile={projectile} />;
    case 'kunai': return <Kunai key={projectile.id} projectile={projectile} />;
    case 'healingcrystals': return <HealingCrystals key={projectile.id} projectile={projectile} />;
    case 'sleep': return <StatusBolt key={projectile.id} projectile={projectile} />;
    case 'poison': return <StatusBolt key={projectile.id} projectile={projectile} />;
    case 'acid': return <StatusBolt key={projectile.id} projectile={projectile} />;
    default: return null;
  }
}

export function Projectiles() {
  const projectiles = useGameStore(s => s.projectiles);
  const renderedProjectiles: ReactNode[] = [];
  for (let index = 0; index < projectiles.length; index += 1) {
    const renderedProjectile = renderProjectile(projectiles[index]);
    if (renderedProjectile !== null) renderedProjectiles.push(renderedProjectile);
  }

  return (
    <>
      {renderedProjectiles}
      <ActivePortals />
    </>
  );
}
