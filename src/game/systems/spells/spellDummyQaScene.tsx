import { useEffect, useRef, useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { SpellType, useGameStore } from "../../../store/gameStore";
import {
  SPELL_DUMMY_MAX_HEALTH,
  SPELL_DUMMY_NAME_PREFIX,
  SPELL_DUMMY_QA_FALLBACK_DELAY_MS,
  SPELL_DUMMY_QA_SEQUENCE,
  getCurrentSpellDummyOrigin,
  publishSpellDummyHit,
} from "./spellDummyQa";
import {
  applySpellDummyHit,
  getNextSpellDummyRespawnAt,
  getSpellDummyQaNowMs,
  makeQaSpellDummyProjectilePlan,
  makeSpellTestDummies,
  parseSpellDummyHitDetail,
  preserveSpellDummyHealth,
  publishSpellDummySnapshot,
  reserveDirectFallbackSpellDummyHit,
  respawnExpiredSpellDummies,
  type SpellTestDummy,
} from "./spellDummyQaSceneRuntime";
import { getLocalProjectileCreatorId } from "./spellProjectileOwnership";
import { getPublishedLastPlayerYaw } from "../player/playerEventBridge";
import { subscribeEnginePlaceableEvent } from "../placeables/enginePlaceableEvents";

export function DevSpellTestDummies() {
  const queryEnabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("qaSpellDummies") === "1";
  if (!queryEnabled) return null;
  return <DeferredDevSpellTestDummies />;
}

function DeferredDevSpellTestDummies() {
  const [rendererReady, setRendererReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    let rafA = 0;
    let rafB = 0;
    const timeout = window.setTimeout(() => setRendererReady(true), 850);
    rafA = window.requestAnimationFrame(() => {
      rafB = window.requestAnimationFrame(() => setRendererReady(true));
    });

    return () => {
      window.cancelAnimationFrame(rafA);
      window.cancelAnimationFrame(rafB);
      window.clearTimeout(timeout);
    };
  }, []);

  if (!rendererReady) return null;
  return <ActiveDevSpellTestDummies />;
}

function ActiveDevSpellTestDummies() {
  const queryEnabled = true;
  const addProjectile = useGameStore(s => s.addProjectile);
  const [enabled, setEnabled] = useState(queryEnabled);
  const [dummies, setDummies] = useState<SpellTestDummy[]>(() => {
    if (typeof window === "undefined" || !queryEnabled) return [];
    return makeSpellTestDummies(getCurrentSpellDummyOrigin(), getPublishedLastPlayerYaw() ?? 0);
  });
  const dummiesRef = useRef<SpellTestDummy[]>(dummies);
  const enabledRef = useRef(enabled);
  const qaSpellIndexRef = useRef(0);
  const qaDirectHitProjectileIdsRef = useRef(new Set<string>());

  useEffect(() => {
    dummiesRef.current = dummies;
  }, [dummies]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const spawnDummiesFromDetail = (detail: Record<string, unknown> = {}) => {
      const currentOrigin = getCurrentSpellDummyOrigin();
      const origin = {
        x: Number.isFinite(Number(detail.x)) ? Number(detail.x) : currentOrigin.x,
        y: Number.isFinite(Number(detail.y)) ? Number(detail.y) : currentOrigin.y,
        z: Number.isFinite(Number(detail.z)) ? Number(detail.z) : currentOrigin.z,
      };
      const yaw = Number.isFinite(Number(detail.yaw)) ? Number(detail.yaw) : getPublishedLastPlayerYaw() ?? 0;
      const preserveHealth = detail.preserveHealth === true;
      setEnabled(true);
      qaDirectHitProjectileIdsRef.current.clear();
      setDummies((current) => {
        const next = makeSpellTestDummies(origin, yaw);
        return preserveHealth ? preserveSpellDummyHealth(next, current) : next;
      });
      if (!preserveHealth) {
        document.documentElement.dataset.wofSpellDummyLastHit = "";
      }
    };
    const spawnDummies = (event?: Event) => {
      const detail = typeof CustomEvent === "function" && event instanceof CustomEvent ? event.detail ?? {} : {};
      spawnDummiesFromDetail(detail);
    };

    const resetDummies = () => {
      const origin = getCurrentSpellDummyOrigin();
      qaDirectHitProjectileIdsRef.current.clear();
      setDummies(makeSpellTestDummies(origin, getPublishedLastPlayerYaw() ?? 0));
      document.documentElement.dataset.wofSpellDummyLastHit = "";
    };

    const handleHit = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail ?? {} : {};
      const hit = parseSpellDummyHitDetail(detail, getSpellDummyQaNowMs());
      if (!hit || !reserveDirectFallbackSpellDummyHit(qaDirectHitProjectileIdsRef.current, hit)) return;

      setEnabled(true);
      setDummies((current) => applySpellDummyHit(current, hit));
      document.documentElement.dataset.wofSpellDummyLastHit = `${hit.id}:${hit.spell}:${Math.round(hit.damage)}`;
      const hitCount = Number(document.documentElement.dataset.wofSpellDummyHits || 0) + 1;
      document.documentElement.dataset.wofSpellDummyHits = String(hitCount);
    };

    const unsubscribeEngineDummySpawn = subscribeEnginePlaceableEvent<Record<string, unknown>>(
      "wof-spawn-spell-dummies",
      (event) => spawnDummiesFromDetail(event.detail ?? {}),
    );
    window.addEventListener("wof-spawn-spell-dummies", spawnDummies);
    window.addEventListener("wof-reset-spell-dummies", resetDummies);
    window.addEventListener("wof-spell-dummy-hit", handleHit);
    if (queryEnabled) window.setTimeout(() => spawnDummies(), 2200);
    return () => {
      window.removeEventListener("wof-spawn-spell-dummies", spawnDummies);
      window.removeEventListener("wof-reset-spell-dummies", resetDummies);
      window.removeEventListener("wof-spell-dummy-hit", handleHit);
      unsubscribeEngineDummySpawn();
    };
  }, [queryEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const castQaSpellAtDummy = (spell: SpellType, targetId = "front") => {
      const plan = makeQaSpellDummyProjectilePlan({
        creatorId: getLocalProjectileCreatorId(),
        dummies: dummiesRef.current,
        nowMs: getSpellDummyQaNowMs(),
        origin: getCurrentSpellDummyOrigin(),
        spell,
        targetId,
      });
      if (!plan) return;

      addProjectile(plan.projectile);
      if (plan.fallbackHit) {
        window.setTimeout(() => {
          publishSpellDummyHit(plan.targetId, plan.projectile);
        }, SPELL_DUMMY_QA_FALLBACK_DELAY_MS);
      }
      document.documentElement.dataset.wofSpellDummyQaCast = spell;
    };

    const handleQaCast = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail ?? {} : {};
      castQaSpellAtDummy(String(detail.spell || "fireball") as SpellType, typeof detail.targetId === "string" ? detail.targetId : "front");
    };

    const handleQaKeyDown = (event: KeyboardEvent) => {
      if (!enabledRef.current || event.repeat) return;
      if (event.code === "F10") {
        event.preventDefault();
        const origin = getCurrentSpellDummyOrigin();
        setDummies(makeSpellTestDummies(origin, getPublishedLastPlayerYaw() ?? 0));
        document.documentElement.dataset.wofSpellDummyLastHit = "";
        return;
      }
      if (event.code !== "F9") return;

      event.preventDefault();
      const spell = SPELL_DUMMY_QA_SEQUENCE[qaSpellIndexRef.current % SPELL_DUMMY_QA_SEQUENCE.length];
      qaSpellIndexRef.current += 1;
      castQaSpellAtDummy(spell);
    };

    window.addEventListener("wof-qa-cast-spell-at-dummy", handleQaCast);
    window.addEventListener("keydown", handleQaKeyDown);
    return () => {
      window.removeEventListener("wof-qa-cast-spell-at-dummy", handleQaCast);
      window.removeEventListener("keydown", handleQaKeyDown);
    };
  }, [addProjectile]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const now = getSpellDummyQaNowMs();
    const nextRespawnAt = getNextSpellDummyRespawnAt(dummies);

    const respawnExpiredDummies = () => {
      setDummies((current) => respawnExpiredSpellDummies(current, getSpellDummyQaNowMs()));
    };

    if (nextRespawnAt === null) return undefined;
    if (nextRespawnAt <= now) {
      respawnExpiredDummies();
      return undefined;
    }

    const respawnTimeout = window.setTimeout(respawnExpiredDummies, nextRespawnAt - now);
    return () => window.clearTimeout(respawnTimeout);
  }, [dummies]);

  useEffect(() => {
    publishSpellDummySnapshot(enabled ? dummies : []);
  }, [dummies, enabled]);

  if (!enabled || dummies.length === 0) return null;

  return (
    <group name="dev-spell-test-dummies">
      {dummies.map((dummy) => {
        const healthRatio = THREE.MathUtils.clamp(dummy.health / SPELL_DUMMY_MAX_HEALTH, 0, 1);
        const isDown = dummy.health <= 0;
        const markerColor = dummy.id === "left"
          ? "#22c55e"
          : dummy.id === "right"
            ? "#38bdf8"
            : dummy.id === "back"
              ? "#facc15"
              : "#f97316";
        return (
          <group
            key={dummy.id}
            name={`${SPELL_DUMMY_NAME_PREFIX}${dummy.id}`}
            position={[dummy.position.x, dummy.position.y, dummy.position.z]}
          >
            <group scale={isDown ? [1.08, 0.34, 1.08] : [1, 1, 1]}>
              <mesh position={[0, -1.58, 0]}>
                <cylinderGeometry args={[1.28, 1.42, 0.36, 8]} />
                <meshBasicMaterial color="#334155" />
              </mesh>
              <mesh position={[0, -0.25, 0]}>
                <boxGeometry args={[1.72, 2.72, 1.08]} />
                <meshBasicMaterial color={isDown ? "#6b7280" : markerColor} />
              </mesh>
              <mesh position={[0, 1.15, 0]}>
                <boxGeometry args={[1.22, 0.86, 0.86]} />
                <meshBasicMaterial color={isDown ? "#9ca3af" : "#fde68a"} />
              </mesh>
              <mesh position={[0, -0.25, -0.43]}>
                <planeGeometry args={[1.32, 1.86]} />
                <meshBasicMaterial color="#111827" transparent opacity={0.86} />
              </mesh>
              <mesh position={[0, 1.78, 0]}>
                <boxGeometry args={[2.45, 0.18, 0.18]} />
                <meshBasicMaterial color={markerColor} />
              </mesh>
              <mesh position={[0, 1.78, 0]}>
                <boxGeometry args={[0.18, 0.18, 2.45]} />
                <meshBasicMaterial color={markerColor} />
              </mesh>
            </group>
            <Html position={[0, 2.72, 0]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
              <div style={{
                width: 108,
                border: `2px solid ${markerColor}`,
                background: "rgba(2,6,23,0.9)",
                padding: 4,
                fontFamily: "monospace",
                color: "#e5e7eb",
                fontSize: 11,
                textAlign: "center",
                textShadow: "0 1px 0 #000",
              }}>
                <div>{dummy.label}</div>
                <div style={{ height: 6, marginTop: 2, background: "#450a0a" }}>
                  <div style={{
                    height: "100%",
                    width: `${Math.round(healthRatio * 100)}%`,
                    background: healthRatio > 0.48 ? "#22c55e" : healthRatio > 0.22 ? "#f59e0b" : "#ef4444",
                  }} />
                </div>
                <div>{Math.round(dummy.health)}/{SPELL_DUMMY_MAX_HEALTH}</div>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
