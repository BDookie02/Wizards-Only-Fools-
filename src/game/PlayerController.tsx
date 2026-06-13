import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody, interactionGroups } from "@react-three/rapier";
import * as THREE from "three";
import { ARMOR_MAX, DARREL_DRAGON_WORLD_POSITION, DARREL_QUEST_CHUNK, DEFAULT_MOUSE_SENSITIVITY, HandType, SpellType, SURVIVAL_BLOCK_SIZE, TOXIC_DAMAGE_PER_SECOND, TUNGSTON_SLOW_DURATION_MS, useGameStore } from "../store/gameStore";
import {
  emitGameNetworkEvent,
  getConnectedNetworkPlayerId,
  getLocalNetworkPlayerId,
} from "./network/gameNetworkClient";
import {
  emitPlayerNetworkSync,
  emitPlayerNetworkPoseSync,
  getPlayerNetworkSyncInterval,
} from "./network/playerNetworkSync";
import { getPrimaryGamepad } from "./systems/input/controllerInput";
import {
  getNumberSlotFromCode,
  installMovementKeyboardListeners,
  isMouseGameplayInputActive,
  isMouseLookFallbackActive,
  keys,
  resetMovementKeys,
} from "./systems/input/playerInputState";
import { isNavigationRecordingActive, recordNavigationSample } from "./navigationRecorderRuntime";
import {
  QA_BASE_VILLAGE_ROAD_HALF_WIDTH,
  QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT,
  QA_DARREL_GROVE_CLEARING_LOCAL_X,
  QA_DARREL_GROVE_CLEARING_LOCAL_Z,
  QA_DARREL_GROVE_DRAGON_DOOR_Z,
  QA_DARREL_GROVE_DRAGON_INTERACT_DISTANCE,
  QA_DARREL_GROVE_DRAGON_INTENT_SECONDS,
  QA_DARREL_GROVE_DRAGON_INTEREST_SCORE,
  QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_X,
  QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z,
  QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X,
  QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z,
  QA_DARREL_GROVE_DRAGON_STEP_JUMP_DISTANCE,
  QA_DARREL_GROVE_RESCUE_Y,
  QA_DUMMY_REANCHOR_COOLDOWN_SECONDS,
  QA_DUMMY_REANCHOR_DISTANCE,
  QA_INTENT_DUMMY_CLOSE_DISTANCE,
  QA_INTENT_DUMMY_KEEP_DISTANCE,
  QA_INTENT_DUMMY_RANGE,
  QA_INTENT_DUMMY_TEST_RANGE,
  QA_INTENT_INTERACT_COOLDOWN_SECONDS,
  QA_INTENT_INTERACT_DISTANCE,
  QA_INTENT_INTEREST_STALE_SECONDS,
  QA_INTENT_MANA_COLLECT_RADIUS,
  QA_INTENT_MANA_LOW_THRESHOLD,
  QA_INTENT_MANA_RANGE,
  QA_INTENT_OBSERVE_SECONDS,
  QA_INTENT_QUEST_RANGE,
  QA_INTENT_REPLAN_MAX_SECONDS,
  QA_INTENT_REPLAN_MIN_SECONDS,
  QA_SPELL_DUMMY_COMBAT_CAST_MAX_INTERVAL,
  QA_SPELL_DUMMY_COMBAT_CAST_MIN_INTERVAL,
  QA_SURVIVAL_COMBAT_CAST_MAX_INTERVAL,
  QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL,
  QA_SURVIVAL_COMBAT_FOCUS_SECONDS,
  QA_SURVIVAL_COMBAT_SPELL_SEQUENCE,
  QA_SURVIVAL_COMBAT_TARGET_RANGE,
  QA_SURVIVAL_INSPECTION_MAX_INTERVAL,
  QA_SURVIVAL_INSPECTION_MAX_SECONDS,
  QA_SURVIVAL_INSPECTION_MIN_INTERVAL,
  QA_SURVIVAL_INSPECTION_MIN_SECONDS,
  QA_SURVIVAL_LOOK_TURN_RATE,
  QA_SURVIVAL_LOW_SPEED_THRESHOLD,
  QA_SURVIVAL_LOW_SPEED_TRIGGER_SECONDS,
  QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE,
  QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE,
  QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE,
  QA_SURVIVAL_PRACTICE_CAST_MAX_INTERVAL,
  QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL,
  QA_SURVIVAL_PRACTICE_SPELL_SEQUENCE,
  QA_SURVIVAL_RECOVERY_CLEAR_EXIT_DISTANCE,
  QA_SURVIVAL_RECOVERY_CLEAR_EXIT_SECONDS,
  QA_SURVIVAL_RECOVERY_MAX_SECONDS,
  QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE,
  QA_SURVIVAL_RECOVERY_MIN_SECONDS,
  QA_SURVIVAL_RECOVERY_NUDGE_DISTANCE,
  QA_SURVIVAL_RECOVERY_NUDGE_SECONDS,
  QA_SURVIVAL_RECOVERY_REVERSE_SECONDS,
  QA_SURVIVAL_RECOVERY_REVERSE_STUCK_SECONDS,
  QA_SURVIVAL_RECOVERY_TURN_RATE,
  QA_SURVIVAL_ROUTE_REACH_DISTANCE,
  QA_SURVIVAL_STUCK_CHECK_SECONDS,
  QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
  QA_SURVIVAL_VIEW_SOFT_CLEARANCE,
  QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  QA_SURVIVAL_WALK_DECISION_MAX_SECONDS,
  QA_SURVIVAL_WALK_DECISION_MIN_SECONDS,
  QA_SURVIVAL_WALK_ESCAPE_TURNS,
  QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE,
  QA_SURVIVAL_WALK_MIN_PROGRESS,
  QA_SURVIVAL_WALK_MIN_TOWARD_PROGRESS,
  QA_SURVIVAL_WALK_PROBE_DISTANCE,
  QA_SURVIVAL_WALK_PROBE_HEIGHTS,
  QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE,
  QA_SURVIVAL_WALK_SOFT_CLEARANCE,
  QA_SURVIVAL_WALK_SOFT_LOOKAHEAD,
  QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR,
  QA_SURVIVAL_WALK_TURN_OPTIONS,
  QA_SURVIVAL_WAYPOINT_MAX_DISTANCE,
  QA_SURVIVAL_WAYPOINT_MIN_DISTANCE,
  angleDeltaRadians,
  getQaSpellDummies,
  getReadyQaManaFlowers,
  getQaSurvivalChunkCenter,
  getQaSurvivalRouteWaypoints,
  getQuestNavigationIntentTargets,
  isQaSpellDummyRunEnabled,
  isSurvivalGameMode,
  lerpAngleRadians,
  moveAngleTowardsRadians,
  normalizeAngleRadians,
  pickQaQuestDialogChoice,
  publishQaPlayerPosition,
  randomRangeFromNoise,
  survivalishTurnNoise,
  type QaSurvivalIntent,
  type QaSurvivalIntentKind,
  type QaSurvivalWalkMode,
} from "./tools/qa/survivalWalkQa";
import { resolveQaWalkRouteSteeringState, resolveQaWalkRouteWaypoint, useQaSurvivalWalkRuntimeState } from "./tools/qa/survivalWalkQaRuntime";
import {
  clearSurvivalWalkRouteTelemetry,
  getSurvivalWalkSpellDummyHitCount,
  isSurvivalWalkBotwGrassUploadReady,
  publishSurvivalWalkAction,
  publishSurvivalWalkFrameTelemetry,
  publishSurvivalWalkPracticeCast,
  publishSurvivalWalkStationaryInput,
  wasSurvivalWalkManaFlowerCollected,
} from "./tools/qa/survivalWalkQaTelemetry";
import { publishManualFastTravelSpawn } from "./tools/manualFastTravelSpawn";
import { getPlayerAimDirectionInto } from "./systems/spells/spellProjectileMath";
import { getEpochMsFromRenderClock } from "./systems/rendering/renderClockEpoch";
import {
  applyCameraLookDelta as applyPlayerCameraLookDelta,
  applyPlayerCameraAntiClip,
  createPlayerCameraAntiClipScratch,
  createPlayerCameraLookScratch,
  createPlayerCameraRollScratch,
  hasCameraRollAgainstWorldUp as hasPlayerCameraRollAgainstWorldUp,
  resetLilyCoilCameraState as resetPlayerLilyCoilCameraState,
} from "./systems/player/playerCameraRuntime";
import { usePlayerControllerRuntimeState } from "./systems/player/playerControllerRuntimeState";
import {
  readPlayerControllerGamepadLookInput,
  readPlayerControllerGamepadMovementInput,
  updatePlayerControllerGamepadArming,
} from "./systems/player/playerControllerGamepadRuntime";
import {
  applyPlayerFloorRecovery,
  getPlayerFloorRecoveryTarget,
  hasPlayerGroundHit,
  resolvePlayerGroundMotionState,
  samplePlayerGroundToi,
} from "./systems/player/playerGroundingRuntime";
import {
  castPlayerWorldRay,
  getExcludeSensorsQueryFlags,
} from "./systems/player/playerRapierQueryRuntime";
import {
  getPlayerControllerEventEpochMs,
  installPlayerControllerWindowListeners,
} from "./systems/player/playerControllerEvents";
import { startPlayerControllerCastingLoop } from "./systems/player/playerControllerCasting";
import { installPlayerLadderZoneListeners } from "./systems/player/playerLadderZones";
import { installPlayerMouseLookFallback } from "./systems/player/playerMouseLookRuntime";
import {
  applyPlayerScreenShake,
  applyPlayerScreenShakeEvent,
} from "./systems/player/playerScreenShakeRuntime";
import { updatePlayerToxicDamageFrame } from "./systems/player/playerToxicDamageRuntime";
import {
  applyPlayerTouchControlEvent,
  applyPlayerTouchHotbarEvent,
  readPlayerTouchCastEvent,
} from "./systems/player/playerTouchInputRuntime";
import {
  LILY_COIL_TUBE_PLAYER_RADIUS,
  QA_LILY_COIL_TUBE_FORWARD,
  QA_LILY_COIL_TUBE_LOOK_AHEAD_T,
  QA_LILY_COIL_TUBE_RESTART_EDGE_T,
  QA_LILY_COIL_TUBE_REVERSE_EDGE_T,
  QA_LILY_COIL_TUBE_STRAFE,
} from "./systems/player/playerLilyCoilTubeRuntime";
import {
  canUsePlayerControllerMode,
  canUsePlayerGameplayInput,
} from "./systems/player/playerGameplayInputGate";
import {
  handlePlayerMeditationKeyDown,
  handlePlayerMeditationKeyUp,
  updatePlayerMeditationExitHold,
} from "./systems/player/playerAstralMeditationRuntime";
import {
  resolvePlayerMovementInputIntent,
  resolvePlayerMovementMotionState,
} from "./systems/player/playerMovementInputRuntime";
import {
  applyPlayerLookInputFrame,
  isPlayerLookInputAllowed,
  resolvePlayerLookInputFrame,
} from "./systems/player/playerLookInputRuntime";
import {
  PLAYER_CASTING_HANDS,
  canPlayerHandCastNow,
  clearPlayerCastingHandState,
  getPlayerSpellForHand,
  hasPlayerRunePowerForHand,
  isPlayerReleaseSelfBuffSpell,
  isPlayerReleaseSuppressedSpell,
  isPlayerSelfBuffSpell,
  resetPlayerControllerAfterCastRelease,
} from "./systems/player/playerHandCastingRuntime";
import {
  createPlayerStateDispatchSnapshot,
  dispatchPlayerMoved,
  dispatchPlayerState,
  dispatchPlayerStateIfChanged,
  dispatchDirectStatusCast,
  dispatchQuestVillagerInteraction,
  dispatchReleaseGrabPlayer,
  dispatchSelfBuffCast,
  publishLastPlayerYaw,
  publishLastTeleportPosition,
  publishLocalPlayerRigidBody,
  publishLocalPlayerPosition,
} from "./systems/player/playerEventBridge";
import {
  applyFlamethrowerSpreadInto,
  createPlayerGrabProjectileId,
  createPlayerSpellProjectileId,
  createQaWalkPracticeProjectileId,
  findAimedRemotePlayerInto,
  findRemotePlayerInAimConeInto,
  getBlinkTeleportOffset,
  getPlayerSpellLaunch,
  getPlayerSpellLaunchInto,
  WIDE_STATUS_AIM_RADIUS,
} from "./systems/spells/playerSpellCasting";
import {
  dispatchQaSpellCastAtDummy,
  dispatchQaSpellDummySpawn,
} from "./systems/spells/spellDummyQa";
import {
  DEFAULT_FALL_RECOVERY_SPAWN_POSITION,
  getInitialPlayerPosition,
  getPlayerSpawnOverride,
  getPlayerSpawnPosition,
} from "./systems/world/survival/survivalPlayerSpawn";
import {
  LILY_COIL_TUBE_JUMP_FORCE,
  LILY_COIL_TUBE_JUMP_GRAVITY,
  LILY_COIL_TUBE_MAX_JUMP_OFFSET,
  LILY_COIL_TUBE_PATH_LENGTH,
  getLilyCoilTubeFrameInto,
  getNearestLilyCoilTubeState,
  isInLilyCoilTubeChunk,
} from "./systems/world/villages/lilyCoilTubeMotion";
import {
  BOOST_FORCE,
  CROUCH_HOLD_MS,
  FLOOR_DEEP_RECOVERY_TRIGGER_Y,
  GRAB_DEFAULT_DISTANCE,
  GRAB_FOLLOW_SPEED,
  GRAB_MAX_DURATION_MS,
  GRAB_THROW_SPEED,
  GROUND_JUMP_MAX_UPWARD_VELOCITY,
  JUMP_BOOST_MULTIPLIER,
  JUMP_FORCE,
  LADDER_CLIMB_SPEED,
  LADDER_IDLE_HOLD_SPEED,
  PLAYER_CAMERA_HEIGHT,
  PLAYER_COLLIDER_HALF_HEIGHT,
  PLAYER_COLLIDER_RADIUS,
  PLAYER_FOOT_OFFSET,
  PLAYER_MEDITATION_CAMERA_HEIGHT,
  SLIDE_RESTART_COOLDOWN_MS,
  SLIDE_START_MIN_SPEED_SQ,
  VCLIP_SPRINT_MULTIPLIER,
  VCLIP_VERTICAL_SPEED,
  getPlayerCameraHeight,
} from "./systems/player/playerMovementConfig";

export function PlayerController() {
  const rigidBody = useRef<RapierRigidBody>(null);
  const { rapier, world } = useRapier();
  const { camera } = useThree();
  const getHealth = () => useGameStore.getState().health;
  const initialPlayerPosition = useMemo(() => getInitialPlayerPosition(), []);
  const forcedSpawnKey = useRef<string | null>(null);
  const {
    qaSurvivalWalkEnabled,
    qaSurvivalWalkStartDelaySeconds,
    qaWalkStartTime,
    qaWalkYaw,
    qaWalkLastDecisionAt,
    qaWalkLastProgressAt,
    qaWalkLastProgressPos,
    qaWalkInputState,
    qaWalkWaypoint,
    qaWalkNextDecisionAt,
    qaWalkInspectUntil,
    qaWalkNextInspectAt,
    qaWalkInspectYaw,
    qaWalkNextCombatCastAt,
    qaWalkCombatFocusUntil,
    qaWalkCombatTargetYaw,
    qaWalkCombatSpellIndex,
    qaWalkLastCombatCastAt,
    qaWalkNextPracticeCastAt,
    qaWalkPracticeSpellIndex,
    qaWalkJumpHeldUntil,
    qaWalkJumpWasPressed,
    qaWalkRecoveryStartedAt,
    qaWalkRecoveryUntil,
    qaWalkRecoveryYaw,
    qaWalkRecoveryStrafe,
    qaWalkRecoveryStartPos,
    qaWalkLastUnstickNudgeAt,
    qaWalkStuckStrikes,
    qaWalkLowSpeedStartedAt,
    qaWalkLilyTubeDirection,
    qaWalkIntent,
    qaWalkNextIntentAt,
    qaWalkLastInteractionAt,
    qaWalkInterestMemory,
    qaWalkLastDialogActionAt,
    qaWalkLastTelemetryAt,
    qaWalkLastTelemetryPos,
    qaWalkLastDummyReanchorAt,
    qaWalkRouteIndex,
    qaWalkRouteSmoothedYaw,
    qaWalkRouteTargetId,
    qaWalkRouteBlockedSince,
    resetQaWalkSession,
    startQaWalkSession,
  } = useQaSurvivalWalkRuntimeState();
  const qaWalkShouldCloseSpellMenu = qaSurvivalWalkEnabled;
  const {
    activeLadderZones,
    slideTimer,
    lastSlideTime,
    crouchHoldStartedAt,
    lastGroundedAt,
    lastBoostTime,
    thrusterLocked,
    lastNetworkSync,
    flamethrowerTimers,
    activeCastingHands,
    activeGrabIds,
    grabTimeouts,
    grabbedState,
    pullVelocity,
    pullFrames,
    screenShake,
    toxicDamageState,
    lilyCoilTubeState,
    controllerLookEuler,
    controllerGameplayArmed,
    keyboardJumpWasPressed,
    controllerJumpWasPressed,
    controllerSprintWasPressed,
    controllerSprintLatched,
    controllerGamepadArmingRefs,
    controllerGamepadMovementRefs,
    controllerGamepadLookInput,
    playerLookInputFrame,
    controllerGamepadMovementInput,
    touchMove,
    touchLookDelta,
    touchButtons,
    touchJumpWasPressed,
    touchSprintWasPressed,
    touchSprintLatched,
    astralExitHoldStartedAt,
    astralExitArmed,
    direction,
    frontVector,
    sideVector,
    grabbedCasterAnchor,
    grabbedHoldPoint,
    grabbedCurrentPosition,
    screenShakeForward,
    screenShakeRight,
    screenShakeUp,
    frameForward,
    qaPosition,
    throwDirection,
    spellAimOrigin,
    spellLaunchOrigin,
    spellDirection,
    spellFlatDirection,
    spellLateral,
    spellTargetScratch,
    spellLaunchScratch,
    grabReleaseDirection,
    tubeCameraForward,
    tubeCameraRight,
    tubeSurfaceForward,
    tubeSurfaceRight,
    tubeCurrentRadial,
    tubeCurrentPlayerUp,
    tubeCurrentAroundSurface,
    tubeMoveDirection,
    tubeRadial,
    tubePlayerUp,
    tubeAroundSurface,
    tubeBodyPosition,
    tubeCameraPosition,
    tubeForward,
    tubeLookDirection,
    tubeUpRotation,
    lilyCoilNearestScratch,
    lilyCoilCurrentFrame,
    lilyCoilNextFrame,
    lilyCoilLookFrame,
    navigationAimDirection,
    cameraTargetPosition,
    playerQueryOptions,
  } = usePlayerControllerRuntimeState();

  const [jumps, setJumps] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [isCrouching, setIsCrouching] = useState(false);
  const playerFrameEpochOffsetRef = useRef<number | null>(null);
  const latestPlayerEpochMsRef = useRef(0);
  const lastDispatchedPlayerStateRef = useRef(createPlayerStateDispatchSnapshot({ isGrounded: true }));
  const cameraRollScratch = useMemo(createPlayerCameraRollScratch, []);
  const cameraAntiClipScratch = useMemo(createPlayerCameraAntiClipScratch, []);
  const cameraLookScratch = useMemo(createPlayerCameraLookScratch, []);

  const isCharging = useGameStore(s => s.isChargingSpell);
  const chargingHands = useGameStore(s => s.chargingHands);
  const leftCurrentSpell = useGameStore(s => s.leftCurrentSpell);
  const rightCurrentSpell = useGameStore(s => s.rightCurrentSpell);
  const isVClipEnabled = useGameStore(s => s.isVClipEnabled);
  const isAstralMeditating = useGameStore(s => s.isAstralMeditating);
  const showHealGlow = isCharging && (
    (leftCurrentSpell === 'healspell' && chargingHands.left) ||
    (rightCurrentSpell === 'healspell' && chargingHands.right)
  );

  const hasCameraRollAgainstWorldUp = () => {
    return hasPlayerCameraRollAgainstWorldUp(camera, cameraRollScratch);
  };

  const getPlayerEventEpochMs = () => getPlayerControllerEventEpochMs(latestPlayerEpochMsRef.current);

  const resetLilyCoilCameraState = (yawOverride?: number, pitchOverride?: number) => {
    return resetPlayerLilyCoilCameraState(camera, controllerLookEuler.current, lilyCoilTubeState.current, yawOverride, pitchOverride, cameraLookScratch);
  };

  const clearToxicEffectsWithNetwork = () => {
    const state = useGameStore.getState();
    const now = getPlayerEventEpochMs();
    if (state.poisonUntil <= now && state.acidUntil <= now) return;

    state.clearToxicEffects();
    const connectedPlayerId = getConnectedNetworkPlayerId();
    if (connectedPlayerId) {
      emitGameNetworkEvent("clearStatusEffect", { targetId: connectedPlayerId, effects: ["poison", "acid"] });
    }
  };

  const applyCameraLookDelta = (yawDelta: number, pitchDelta: number) => {
    applyPlayerCameraLookDelta(camera, controllerLookEuler.current, lilyCoilTubeState.current, yawDelta, pitchDelta, cameraLookScratch);
  };

  useEffect(() => {
    return installPlayerLadderZoneListeners(activeLadderZones);
  }, []);

  useEffect(() => {
    return installPlayerMouseLookFallback({
      applyCameraLookDelta,
      getMouseSensitivity: () => useGameStore.getState().mouseSensitivity || DEFAULT_MOUSE_SENSITIVITY,
      isMouseLookFallbackActive,
    });
  }, [camera]);

  const throwGrabbedPlayer = (overrideDir?: THREE.Vector3) => {
    const grabbed = grabbedState.current;
    if (!rigidBody.current || !grabbed) return;

    const throwDir = throwDirection.copy(overrideDir ?? grabbed.dir).normalize();
    rigidBody.current.setLinvel({
      x: throwDir.x * GRAB_THROW_SPEED,
      y: THREE.MathUtils.clamp(throwDir.y * GRAB_THROW_SPEED, -18, 26),
      z: throwDir.z * GRAB_THROW_SPEED,
    }, true);
    grabbedState.current = null;
  };

  const applyScreenShake = () => {
    applyPlayerScreenShake(
      camera,
      screenShake.current,
      getPlayerEventEpochMs(),
      screenShakeForward,
      screenShakeRight,
      screenShakeUp,
    );
  };

  useEffect(() => {
    const lastFire: Record<HandType, number> = { left: 0, right: 0 };
    const armControllerAfterRelease = () => {
      resetPlayerControllerAfterCastRelease({
        controllerGameplayArmed,
        keyboardJumpWasPressed,
        controllerJumpWasPressed,
        controllerSprintWasPressed,
        controllerSprintLatched,
      });
    };
    const canUseGameplayInput = () => {
      const state = useGameStore.getState();
      const controllerGameplayReady = state.isControllerGameplayActive && controllerGameplayArmed.current;
      return canUsePlayerGameplayInput(state, {
        mouseGameplayActive: isMouseGameplayInputActive(),
        controllerGameplayReady,
      });
    };

    const castSelfBuffSpell = (hand: HandType, spell: SpellType) => {
      const store = useGameStore.getState();
      store.setHandCharging(hand, true);
      window.setTimeout(() => {
        useGameStore.getState().setHandCharging(hand, false);
      }, 180);

      if (spell === 'magicarmor') {
        store.activateMagicArmor();
        emitGameNetworkEvent("setArmor", ARMOR_MAX);
        dispatchSelfBuffCast({ spell, hand, armor: ARMOR_MAX });
        return true;
      }

      if (spell === 'speedboost') {
        store.activateSpeedBoost();
        dispatchSelfBuffCast({ spell, hand });
        return true;
      }

      if (spell === 'jumpboost') {
        store.activateJumpBoost();
        const velocity = rigidBody.current?.linvel();
        if (velocity && rigidBody.current) {
          rigidBody.current.setLinvel({
            x: velocity.x,
            y: Math.max(velocity.y, JUMP_FORCE * JUMP_BOOST_MULTIPLIER),
            z: velocity.z,
          }, true);
        }
        dispatchSelfBuffCast({ spell, hand });
        return true;
      }

      if (spell === 'magicglassorb') {
        store.activateMagicGlassOrb();
        dispatchSelfBuffCast({ spell, hand });
        return true;
      }

      return false;
    };

    const castDirectTungston = (hand: HandType) => {
      const store = useGameStore.getState();
      const dir = spellDirection;
      camera.getWorldDirection(dir);
      dir.normalize();
      const { spawnPos, realDir } = getPlayerSpellLaunchInto(hand, camera, dir, spellLaunchScratch);

      store.setHandCharging(hand, true);
      window.setTimeout(() => {
        useGameStore.getState().setHandCharging(hand, false);
      }, 160);

      const target = findAimedRemotePlayerInto(store.players, [
        { origin: spellAimOrigin.copy(camera.position), dir },
        {
          origin: spellLaunchOrigin.set(spawnPos.x, spawnPos.y, spawnPos.z),
          dir: realDir,
          radius: WIDE_STATUS_AIM_RADIUS,
        },
      ], spellTargetScratch) ?? findRemotePlayerInAimConeInto(store.players, spellAimOrigin, dir, spellTargetScratch);
      if (!target) {
        return false;
      }

      const until = getPlayerEventEpochMs() + TUNGSTON_SLOW_DURATION_MS;
      store.updatePlayer(target.id, { slowUntil: until });
      emitGameNetworkEvent("applyStatusEffect", {
        targetId: target.id,
        effect: "slow",
        durationMs: TUNGSTON_SLOW_DURATION_MS,
      });
      dispatchDirectStatusCast({ spell: "tungstonballsack", hand, targetId: target.id });
      return true;
    };

    const stopHandCasting = (hand: HandType) => {
      clearPlayerCastingHandState(activeCastingHands, hand, useGameStore.getState().setHandCharging);
    };

    const emitGrabRelease = (hand: HandType) => {
      const grabId = activeGrabIds.current[hand];
      if (!grabId) return;

      if (grabTimeouts.current[hand] !== null) {
        window.clearTimeout(grabTimeouts.current[hand]!);
        grabTimeouts.current[hand] = null;
      }

      const dir = spellDirection;
      camera.getWorldDirection(dir);
      const { spawnPos, realDir } = getPlayerSpellLaunchInto(hand, camera, dir, spellLaunchScratch);
      const releaseOrigin = { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };
      const releasedAt = getPlayerEventEpochMs();
      const releaseProjectile = {
        id: `${grabId}-release-${releasedAt}`,
        creatorId: getLocalNetworkPlayerId(),
        type: 'grab' as const,
        pos: releaseOrigin,
        dir: { x: realDir.x, y: realDir.y, z: realDir.z },
        createdAt: releasedAt,
        hand,
        grabId,
        grabPhase: 'release' as const,
      };

      activeGrabIds.current[hand] = null;
      emitGameNetworkEvent("castSpell", releaseProjectile);
      emitGameNetworkEvent("grabRelease", {
        grabId,
        hand,
        origin: releaseOrigin,
        aimDir: releaseProjectile.dir,
      });
      useGameStore.getState().addProjectile(releaseProjectile);
      dispatchReleaseGrabPlayer({ casterId: getLocalNetworkPlayerId(), grabId, dir: releaseProjectile.dir, origin: releaseOrigin });
    };

    const stopAllCasting = () => {
      for (let handIndex = 0; handIndex < PLAYER_CASTING_HANDS.length; handIndex += 1) {
        const hand = PLAYER_CASTING_HANDS[handIndex];
        emitGrabRelease(hand);
        stopHandCasting(hand);
      }
    };

    const requestQuestVillagerInteraction = () => {
      return dispatchQuestVillagerInteraction("cast").handled;
    };

    const onMeditationKeyDown = (e: KeyboardEvent) => {
      handlePlayerMeditationKeyDown(e, {
        state: useGameStore.getState(),
        astralExitHoldStartedAt,
        astralExitArmed,
        stopAllCasting,
        resetMovementKeys,
        getNowMs: getPlayerEventEpochMs,
      });
    };

    const onMeditationKeyUp = (e: KeyboardEvent) => {
      handlePlayerMeditationKeyUp(e, {
        state: useGameStore.getState(),
        astralExitHoldStartedAt,
        astralExitArmed,
      });
    };
    
    const startHandCast = (hand: HandType) => {
      // Must be locked to shoot
      if (useGameStore.getState().isSpellMenuOpen || !useGameStore.getState().isMagicArmed) return;
      if (!canUseGameplayInput()) return;
      const now = getPlayerEventEpochMs();
      if (useGameStore.getState().sleepUntil > now) return;
      if (getHealth() <= 0) {
        if (now - Math.max(lastFire.left, lastFire.right) > 1000) { // simple debounce so they don't instarespawn
          useGameStore.getState().respawn();
          
          if (rigidBody.current) {
            const [spawnX, spawnY, spawnZ] = getPlayerSpawnPosition();
            rigidBody.current.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
            rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
            camera.position.set(spawnX, spawnY + PLAYER_CAMERA_HEIGHT, spawnZ);
          }
        }
        return;
      }

      const spell = getPlayerSpellForHand(useGameStore.getState(), hand);
      if (!hasPlayerRunePowerForHand(useGameStore.getState(), hand)) {
        stopHandCasting(hand);
        return;
      }
      if (activeCastingHands.current[hand]) return;

      if (!canPlayerHandCastNow(lastFire, hand, spell, now)) return;

      if (isPlayerSelfBuffSpell(spell)) {
        lastFire[hand] = now;
        castSelfBuffSpell(hand, spell);
        return;
      }

      activeCastingHands.current[hand] = true;
      useGameStore.getState().setHandCharging(hand, true);

      if (spell === 'grab') {
        const r = rigidBody.current;
        if (!r) {
          stopHandCasting(hand);
          return;
        }

        lastFire[hand] = now;
        const d = spellDirection;
        camera.getWorldDirection(d);
        const { spawnPos, realDir } = getPlayerSpellLaunchInto(hand, camera, d, spellLaunchScratch);
        const projectileOrigin = { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };
        const grabId = createPlayerGrabProjectileId(getLocalNetworkPlayerId(), hand, now);
        const projectile = {
          id: grabId,
          creatorId: getLocalNetworkPlayerId(),
          type: 'grab' as const,
          pos: projectileOrigin,
          dir: { x: realDir.x, y: realDir.y, z: realDir.z },
          createdAt: now,
          hand,
          grabId,
          grabPhase: 'cast' as const,
        };

        activeGrabIds.current[hand] = grabId;
        if (grabTimeouts.current[hand] !== null) {
          window.clearTimeout(grabTimeouts.current[hand]!);
        }
        grabTimeouts.current[hand] = window.setTimeout(() => {
          emitGrabRelease(hand);
          stopHandCasting(hand);
        }, GRAB_MAX_DURATION_MS);

        emitGameNetworkEvent("castSpell", projectile);
        emitGameNetworkEvent("grabControl", {
          grabId,
          hand,
          origin: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          aimDir: { x: d.x, y: d.y, z: d.z },
        });
        useGameStore.getState().addProjectile(projectile);
        return;
      }

      if (spell === 'iceshard' || spell === 'arcanebeam') {
        const r = rigidBody.current;
        if (r) {
          lastFire[hand] = now;
          const d = spellDirection;
          camera.getWorldDirection(d);
          const { spawnPos, realDir } = getPlayerSpellLaunchInto(hand, camera, d, spellLaunchScratch);

          const proj = {
            id: createPlayerSpellProjectileId(),
            creatorId: getLocalNetworkPlayerId(),
            type: spell as string,
            pos: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
            dir: { x: realDir.x, y: realDir.y, z: realDir.z },
            createdAt: now,
            hand
          };
          
          emitGameNetworkEvent("castSpell", proj);
          useGameStore.getState().addProjectile(proj as any);
        }
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      if (useGameStore.getState().questNpcEditorTarget || useGameStore.getState().questDialogSession || useGameStore.getState().isInventoryOpen) return;
      if (e.button === 0 || e.button === 2) {
        if (canUseGameplayInput() && requestQuestVillagerInteraction()) {
          e.preventDefault();
          return;
        }
        startHandCast(e.button === 2 ? 'right' : 'left');
      }
    };

    const releaseHandCast = (hand: HandType) => {
      if (useGameStore.getState().isSpellMenuOpen) {
        stopAllCasting();
        return;
      }
      if (!activeCastingHands.current[hand]) return;
      const currentSpell = getPlayerSpellForHand(useGameStore.getState(), hand);
      stopHandCasting(hand);

      if (currentSpell === 'grab') {
        emitGrabRelease(hand);
        return;
      }

      if (!useGameStore.getState().isMagicArmed) return;
      
      if (!canUseGameplayInput() || getHealth() <= 0) return;

      if (isPlayerReleaseSuppressedSpell(currentSpell)) return;
      if (!hasPlayerRunePowerForHand(useGameStore.getState(), hand)) return;

      const releasedAt = getPlayerEventEpochMs();
      lastFire[hand] = releasedAt;

      if (currentSpell === 'tungstonballsack') {
        castDirectTungston(hand);
        return;
      }

      if (isPlayerReleaseSelfBuffSpell(currentSpell)) {
        castSelfBuffSpell(hand, currentSpell);
        return;
      }

      // Shoot!
      const r = rigidBody.current;
      if (!r) return;
      const pos = r.translation();
      
      // Calculate forward direction from camera
      const dir = spellDirection;
      camera.getWorldDirection(dir);
      
      let { spawnPos, realDir } = getPlayerSpellLaunchInto(hand, camera, dir, spellLaunchScratch);

      if (currentSpell === 'tornado' || currentSpell === 'meteorshower') {
        const flatDir = spellFlatDirection.set(dir.x, 0, dir.z);
        if (flatDir.lengthSq() < 0.001) flatDir.set(0, 0, -1);
        flatDir.normalize();
        const summonDistance = currentSpell === 'meteorshower' ? 32 : 22;
        const groundY = pos.y - PLAYER_FOOT_OFFSET + 0.2;
        spawnPos = {
          x: pos.x + flatDir.x * summonDistance,
          y: groundY,
          z: pos.z + flatDir.z * summonDistance,
        };
        realDir = flatDir;
      }
      const projectileOrigin = { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };
      const projectileDir = { x: realDir.x, y: realDir.y, z: realDir.z };
      
      if (currentSpell === 'blink') {
        // Teleports player to a random location nearby
        const blinkOffset = getBlinkTeleportOffset();
        r.setTranslation({
          x: pos.x + blinkOffset.x,
          y: pos.y + 10, // A bit higher for longer distances
          z: pos.z + blinkOffset.z
        }, true);
      }

      emitGameNetworkEvent("castSpell", {
        type: currentSpell,
        pos: projectileOrigin,
        dir: projectileDir,
        hand
      });
      
      useGameStore.getState().addProjectile({
        id: createPlayerSpellProjectileId(),
        creatorId: getLocalNetworkPlayerId(),
        type: currentSpell,
        pos: projectileOrigin,
        dir: projectileDir,
        createdAt: releasedAt,
        hand
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (useGameStore.getState().questNpcEditorTarget || useGameStore.getState().questDialogSession || useGameStore.getState().isInventoryOpen) return;
      if (e.button === 0 || e.button === 2) {
        releaseHandCast(e.button === 2 ? 'right' : 'left');
      }
    };

    const onMobileControl = (e: Event) => {
      applyPlayerTouchControlEvent(e, touchMove, touchLookDelta, touchButtons);
    };

    const onMobileCast = (e: Event) => {
      const { hand, phase } = readPlayerTouchCastEvent(e);
      if (phase === 'start') {
        startHandCast(hand);
      } else {
        releaseHandCast(hand);
      }
    };

    const onMobileHotbar = (e: Event) => {
      applyPlayerTouchHotbarEvent(e);
    };
    
    // Wheel to switch spells
    const onWheel = (e: WheelEvent) => {
      const store = useGameStore.getState();
      if (store.isSpellMenuOpen || !store.isMagicArmed) return;
      if (!canUseGameplayInput()) return;
      const hand: HandType = keys.KeyQ ? 'right' : 'left';
      if (e.deltaY > 0) store.nextSpell(hand);
      else store.prevSpell(hand);
    };

    const onHotbarKeyDown = (e: KeyboardEvent) => {
      const store = useGameStore.getState();
      if (store.isSpellMenuOpen || !store.isMagicArmed || store.health <= 0) return;
      if (!canUseGameplayInput()) return;

      const slotIndex = getNumberSlotFromCode(e.code);
      if (slotIndex === -1) return;

      e.preventDefault();
      store.selectHotbarSlot(slotIndex, keys.KeyQ ? 'right' : 'left');
    };

    const onContextMenu = (e: MouseEvent) => {
      if (canUseGameplayInput()) {
        e.preventDefault();
      }
    };

    const stopControllerCastingLoop = startPlayerControllerCastingLoop({
      canUseGameplayInput,
      requestQuestVillagerInteraction,
      startHandCast,
      releaseHandCast,
    });

    const onTeleport = (e: any) => {
      if (!rigidBody.current) return;
      const detail = e.detail ?? {};
      const teleportPosition = {
        x: Number(detail.x),
        y: Number(detail.y),
        z: Number(detail.z),
      };
      if (!Number.isFinite(teleportPosition.x) || !Number.isFinite(teleportPosition.y) || !Number.isFinite(teleportPosition.z)) return;
      rigidBody.current.setTranslation(teleportPosition, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.set(teleportPosition.x, teleportPosition.y + PLAYER_CAMERA_HEIGHT, teleportPosition.z);
      const yaw = Number(detail.yaw);
      const resolvedYaw = resetLilyCoilCameraState(Number.isFinite(yaw) ? yaw : undefined);
      resetQaWalkSession(teleportPosition);
      const now = getPlayerEventEpochMs();
      const manualFastTravelSpawn = publishManualFastTravelSpawn({
        x: teleportPosition.x,
        y: teleportPosition.y,
        z: teleportPosition.z,
        yaw: Number.isFinite(yaw) ? yaw : undefined,
      }, now);
      forcedSpawnKey.current = manualFastTravelSpawn.key;
      publishLocalPlayerPosition(teleportPosition, { rememberLast: true });
      publishQaPlayerPosition(teleportPosition);
      publishLastTeleportPosition(teleportPosition);
      dispatchPlayerMoved({
        ...teleportPosition,
        angle: resolvedYaw,
        isMoving: false,
        grounded: false,
      });
    };

    const onPull = (e: any) => {
      pullVelocity.current.copy(e.detail);
      pullFrames.current = 15; // apply for 15 frames
    };

    const onScreenShake = (e: any) => {
      applyPlayerScreenShakeEvent(screenShake.current, e.detail ?? {}, getPlayerEventEpochMs());
    };

    const onGrabPlayer = (e: any) => {
      const detail = e.detail ?? {};
      const casterId = detail.casterId;
      if (!casterId || casterId === getLocalNetworkPlayerId()) return;

      const grabbed = grabbedState.current ?? {
        casterId,
        grabId: detail.grabId,
        dir: new THREE.Vector3(),
        origin: new THREE.Vector3(),
        distance: GRAB_DEFAULT_DISTANCE,
        lastControlAt: 0,
        until: 0,
      };
      grabbed.casterId = casterId;
      grabbed.grabId = detail.grabId;
      grabbed.dir.set(detail.dir?.x ?? 0, detail.dir?.y ?? 0, detail.dir?.z ?? -1).normalize();
      grabbed.origin.set(
        detail.origin?.x ?? camera.position.x,
        detail.origin?.y ?? camera.position.y,
        detail.origin?.z ?? camera.position.z,
      );
      grabbed.distance = Math.max(4, Math.min(36, detail.distance ?? GRAB_DEFAULT_DISTANCE));
      const now = getPlayerEventEpochMs();
      grabbed.lastControlAt = now;
      grabbed.until = now + GRAB_MAX_DURATION_MS;
      grabbedState.current = grabbed;
    };

    const onGrabControl = (e: any) => {
      const grabbed = grabbedState.current;
      const detail = e.detail ?? {};
      if (!grabbed) return;

      const casterId = detail.id ?? detail.casterId;
      const sameGrab = detail.grabId && grabbed.grabId === detail.grabId;
      const sameCaster = casterId && grabbed.casterId === casterId;
      if (!sameGrab && !sameCaster) return;

      const aimDir = detail.aimDir ?? detail.dir;
      const origin = detail.origin;
      if (aimDir) {
        grabbed.dir.set(aimDir.x ?? 0, aimDir.y ?? 0, aimDir.z ?? -1).normalize();
      }
      if (origin) {
        grabbed.origin.set(origin.x ?? grabbed.origin.x, origin.y ?? grabbed.origin.y, origin.z ?? grabbed.origin.z);
      }
      grabbed.lastControlAt = getPlayerEventEpochMs();
    };

    const onReleaseGrabPlayer = (e: any) => {
      const grabbed = grabbedState.current;
      if (!grabbed) return;

      const detail = e.detail ?? {};
      const sameGrab = detail.grabId && grabbed.grabId === detail.grabId;
      const sameCaster = detail.casterId && grabbed.casterId === detail.casterId;
      if (!sameGrab && !sameCaster) return;

      const releaseDir = grabReleaseDirection
        .set(detail.dir?.x ?? grabbed.dir.x, detail.dir?.y ?? grabbed.dir.y, detail.dir?.z ?? grabbed.dir.z)
        .normalize();
      throwGrabbedPlayer(releaseDir);
    };

    const removeMovementKeyboardListeners = installMovementKeyboardListeners();
    const removeWindowListeners = installPlayerControllerWindowListeners({
      onMouseDown,
      onMouseUp,
      onMobileControl,
      onMobileCast,
      onMobileHotbar,
      onWheel,
      onMeditationKeyDown,
      onMeditationKeyUp,
      onHotbarKeyDown,
      onContextMenu,
      onTeleport,
      onPull,
      onScreenShake,
      onGrabPlayer,
      onGrabControl,
      onReleaseGrabPlayer,
      onCommandConsoleOpened: resetMovementKeys,
      onControllerGameplayStarted: armControllerAfterRelease,
    });
    return () => {
      stopAllCasting();
      for (let handIndex = 0; handIndex < PLAYER_CASTING_HANDS.length; handIndex += 1) {
        const hand = PLAYER_CASTING_HANDS[handIndex];
        if (grabTimeouts.current[hand] !== null) {
          window.clearTimeout(grabTimeouts.current[hand]!);
          grabTimeouts.current[hand] = null;
        }
      }
      removeWindowListeners();
      removeMovementKeyboardListeners();
      stopControllerCastingLoop();
    };
  }, [camera]);

  useFrame((state, delta) => {
    if (!rigidBody.current) return;
    let health = getHealth();
    if (health <= 0) return;

    const storeState = useGameStore.getState();
    const velocity = rigidBody.current.linvel();
    const pos = rigidBody.current.translation();
    const nowMs = getEpochMsFromRenderClock(state.clock.elapsedTime, playerFrameEpochOffsetRef);
    latestPlayerEpochMsRef.current = nowMs;
    const gamepad = getPrimaryGamepad();
    const sleepActive = storeState.sleepUntil > nowMs;
    const slowActive = storeState.slowUntil > nowMs;
    const vclipActive = storeState.isVClipEnabled;
    const astralActive = updatePlayerMeditationExitHold(storeState, nowMs, astralExitHoldStartedAt);
    const mouseGameplayRequested = isMouseGameplayInputActive();
    const controllerGameplayRequested = storeState.isControllerGameplayActive || mouseGameplayRequested;
    const controllerModeReady = canUsePlayerControllerMode(storeState, {
      gamepadConnected: Boolean(gamepad),
      controllerGameplayRequested,
      astralActive,
    });
    const controllerInputActive = updatePlayerControllerGamepadArming({
      gamepad,
      controllerGameplayRequested,
      controllerModeReady,
      controllerBindings: storeState.controllerBindings,
      refs: controllerGamepadArmingRefs,
    });
    const gameplayInputActive = Boolean(mouseGameplayRequested || storeState.isTouchControlsActive || controllerInputActive);
    const survivalModeActive = isSurvivalGameMode(storeState.gameMode);
    playerQueryOptions.filterFlags = getExcludeSensorsQueryFlags(rapier);
    playerQueryOptions.filterExcludeCollider = undefined;
    playerQueryOptions.filterExcludeRigidBody = rigidBody.current;
    playerQueryOptions.filterPredicate = undefined;
    publishLocalPlayerPosition(pos, { rememberLast: true });
    publishLocalPlayerRigidBody(rigidBody.current);
    publishQaPlayerPosition(pos);

    const spawnOverride = getPlayerSpawnOverride();
    if (spawnOverride && forcedSpawnKey.current !== spawnOverride.key) {
      const [spawnX, spawnY, spawnZ] = spawnOverride.position;
      rigidBody.current.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.set(spawnX, spawnY + PLAYER_CAMERA_HEIGHT, spawnZ);
      const spawnYaw = Number(spawnOverride.yaw);
      const spawnPitch = Number(spawnOverride.pitch);
      const resolvedYaw = resetLilyCoilCameraState(
        Number.isFinite(spawnYaw) ? spawnYaw : undefined,
        Number.isFinite(spawnPitch) ? spawnPitch : undefined,
      );
      resetQaWalkSession({ x: spawnX, y: spawnY, z: spawnZ });
      forcedSpawnKey.current = spawnOverride.key;
      publishLocalPlayerPosition({ x: spawnX, y: spawnY, z: spawnZ }, { rememberLast: true });
      publishQaPlayerPosition({ x: spawnX, y: spawnY, z: spawnZ });
      dispatchPlayerMoved({ x: spawnX, y: spawnY, z: spawnZ, angle: resolvedYaw, isMoving: false, grounded: false });
      return;
    }

    const toxicStatusActive = storeState.poisonUntil > nowMs || storeState.acidUntil > nowMs;
    const connectedPlayerId = toxicStatusActive ? getConnectedNetworkPlayerId() : null;
    const toxicDamageFrame = updatePlayerToxicDamageFrame(toxicDamageState.current, {
      acidUntil: storeState.acidUntil,
      connectedPlayerId,
      deltaSeconds: delta,
      health,
      nowMs,
      poisonUntil: storeState.poisonUntil,
      toxicDamagePerSecond: TOXIC_DAMAGE_PER_SECOND,
    });
    if (toxicDamageFrame.active) {
      health = toxicDamageFrame.health;
      useGameStore.getState().setHealth(health);
      if (connectedPlayerId && toxicDamageFrame.syncDamage > 0) {
        emitGameNetworkEvent("damageHealth", connectedPlayerId, toxicDamageFrame.syncDamage);
      }
      if (health <= 0) return;
    }

    const activeGrab = grabbedState.current;
    if (activeGrab) {
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;
      if (nowMs >= activeGrab.until) {
        throwGrabbedPlayer();
        return;
      }

      const caster = storeState.players[activeGrab.casterId];
      const hasRecentControl = nowMs - activeGrab.lastControlAt < 450;
      const liveAimDir = hasRecentControl ? activeGrab.dir : caster ? getPlayerAimDirectionInto(caster, spellDirection) : activeGrab.dir;
      activeGrab.dir.copy(liveAimDir);

      const casterAnchor = hasRecentControl
        ? grabbedCasterAnchor.copy(activeGrab.origin)
        : caster
          ? grabbedCasterAnchor.set(caster.pos[0], caster.pos[1] + PLAYER_CAMERA_HEIGHT, caster.pos[2])
          : grabbedCasterAnchor.copy(activeGrab.origin);
      const holdPoint = grabbedHoldPoint.copy(casterAnchor).addScaledVector(liveAimDir, activeGrab.distance);
      const currentPos = grabbedCurrentPosition.set(pos.x, pos.y, pos.z);
      const followAlpha = 1 - Math.exp(-GRAB_FOLLOW_SPEED * delta);
      const nextGrabPos = currentPos.lerp(holdPoint, followAlpha);

      rigidBody.current.setTranslation(nextGrabPos, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.lerp(cameraTargetPosition.current.set(nextGrabPos.x, nextGrabPos.y + PLAYER_CAMERA_HEIGHT, nextGrabPos.z), 0.55);
      applyScreenShake();
      publishLocalPlayerPosition(nextGrabPos);

      camera.getWorldDirection(frameForward);
      const yaw = Math.atan2(frameForward.x, -frameForward.z);
      dispatchPlayerStateIfChanged(lastDispatchedPlayerStateRef.current, false, false, false, false, false, false);
      dispatchPlayerMoved({ x: nextGrabPos.x, y: nextGrabPos.y, z: nextGrabPos.z, angle: yaw, isMoving: false, grounded: false });

      if (nowMs - lastNetworkSync.current > 1000 / 30) {
        lastNetworkSync.current = nowMs;
        emitPlayerNetworkPoseSync({
          anim: "grabbed",
          camera,
          characterCustomization: storeState.characterCustomization,
          isVoiceSpeaking: storeState.isVoiceSpeaking,
          pos: { x: nextGrabPos.x, y: nextGrabPos.y, z: nextGrabPos.z },
          survivalLevel: storeState.survivalLevel,
          yaw,
        });
      }
      return;
    }

    if (astralActive) {
      if (isSliding) setIsSliding(false);
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;
      for (let handIndex = 0; handIndex < PLAYER_CASTING_HANDS.length; handIndex += 1) {
        const hand = PLAYER_CASTING_HANDS[handIndex];
        if (activeCastingHands.current[hand] || storeState.chargingHands[hand]) {
          clearPlayerCastingHandState(activeCastingHands, hand, useGameStore.getState().setHandCharging);
        }
        flamethrowerTimers.current[hand] = 0;
      }

      rigidBody.current.setLinvel({ x: 0, y: vclipActive ? 0 : velocity.y, z: 0 }, true);
      camera.position.lerp(cameraTargetPosition.current.set(pos.x, pos.y + PLAYER_MEDITATION_CAMERA_HEIGHT, pos.z), 0.18);
      applyScreenShake();
      publishLocalPlayerPosition(pos);

      camera.getWorldDirection(frameForward);
      const yaw = Math.atan2(frameForward.x, -frameForward.z);

      dispatchPlayerStateIfChanged(lastDispatchedPlayerStateRef.current, false, false, false, false, true, true);
      dispatchPlayerMoved({ x: pos.x, y: pos.y, z: pos.z, angle: yaw, isMoving: false, grounded: true });

      if (nowMs - lastNetworkSync.current > 1000 / 15) {
        lastNetworkSync.current = nowMs;
        emitPlayerNetworkPoseSync({
          anim: "meditate",
          camera,
          characterCustomization: storeState.characterCustomization,
          isVoiceSpeaking: storeState.isVoiceSpeaking,
          pos,
          survivalLevel: storeState.survivalLevel,
          yaw,
        });
      }
      return;
    }

    const lookInputAllowed = isPlayerLookInputAllowed({
      isSpellMenuOpen: storeState.isSpellMenuOpen,
      questDialogActive: Boolean(storeState.questDialogSession),
      isInventoryOpen: storeState.isInventoryOpen,
      gameplayInputActive,
      sleepActive,
    });
    if (lookInputAllowed) {
      readPlayerControllerGamepadLookInput({
        gamepad,
        controllerInputActive,
        target: controllerGamepadLookInput,
      });
    }

    const lookInputFrame = resolvePlayerLookInputFrame({
      deltaSeconds: delta,
      lookInputAllowed,
      controllerLookX: controllerGamepadLookInput.lookX,
      controllerLookY: controllerGamepadLookInput.lookY,
      controllerLookSensitivity: storeState.controllerLookSensitivity,
      touchControlsActive: storeState.isTouchControlsActive,
      touchLookX: touchLookDelta.current.x,
      touchLookY: touchLookDelta.current.y,
      mouseGameplayRequested,
      mouseSensitivity: storeState.mouseSensitivity,
      keyboardArrowLookEnabled: storeState.keyboardArrowLookEnabled,
      isPauseMenuOpen: storeState.isPauseMenuOpen,
      isSpellMenuOpen: storeState.isSpellMenuOpen,
      questDialogActive: Boolean(storeState.questDialogSession),
      isInventoryOpen: storeState.isInventoryOpen,
      isMapExpanded: storeState.isMapExpanded,
      isScoreboardOpen: storeState.isScoreboardOpen,
      arrowRight: keys.ArrowRight,
      arrowLeft: keys.ArrowLeft,
      arrowDown: keys.ArrowDown,
      arrowUp: keys.ArrowUp,
    }, playerLookInputFrame);

    applyPlayerLookInputFrame(lookInputFrame, applyCameraLookDelta);
    if (lookInputFrame.clearTouchLook) {
      touchLookDelta.current.x = 0;
      touchLookDelta.current.y = 0;
    }

    const qaSurvivalModeActive = storeState.gameMode === "solo-survival" || storeState.gameMode === "multiplayer-survival";
    if (qaSurvivalWalkEnabled && qaSurvivalModeActive && storeState.questDialogSession && nowMs - qaWalkLastDialogActionAt.current > 1250) {
      const choice = pickQaQuestDialogChoice(storeState.questDialogSession);
      qaWalkLastDialogActionAt.current = nowMs;
      if (choice) {
        useGameStore.getState().chooseQuestDialogChoice(choice.id);
        publishSurvivalWalkAction(`dialog:${choice.id}`);
      } else {
        useGameStore.getState().closeQuestDialog();
        publishSurvivalWalkAction("dialog:close");
      }
    }

    const qaWalkActive = qaSurvivalWalkEnabled && !storeState.questDialogSession && !storeState.isInventoryOpen && qaSurvivalModeActive;
    if (qaWalkActive && storeState.isSpellMenuOpen && qaWalkShouldCloseSpellMenu) {
      storeState.setSpellMenuOpen(false);
    }
    if (qaWalkActive && !useGameStore.getState().isSpellMenuOpen && !sleepActive) {
      if (qaWalkStartTime.current === null) {
        startQaWalkSession({
          startedAt: state.clock.elapsedTime,
          position: pos,
          nextInspectAt: randomRangeFromNoise(
            survivalishTurnNoise(pos.x, pos.z, state.clock.elapsedTime),
            QA_SURVIVAL_INSPECTION_MIN_INTERVAL,
            QA_SURVIVAL_INSPECTION_MAX_INTERVAL,
          ),
        });
      }

      const elapsed = state.clock.elapsedTime - qaWalkStartTime.current;
      const qaTravelElapsed = Math.max(0, elapsed - qaSurvivalWalkStartDelaySeconds);
      if (qaSurvivalWalkStartDelaySeconds > 0 && elapsed < qaSurvivalWalkStartDelaySeconds) {
        qaWalkInputState.current = { forward: 0, strafe: 0, sprint: false, mode: "travel" };
        publishSurvivalWalkStationaryInput("delay", `delay:${Math.max(0, qaSurvivalWalkStartDelaySeconds - elapsed).toFixed(1)}`);
        return;
      }
      camera.getWorldDirection(frameForward);
      const currentYaw = Math.atan2(frameForward.x, -frameForward.z);
      if (qaWalkYaw.current === null) {
        qaWalkYaw.current = currentYaw;
        qaWalkLastProgressAt.current = elapsed;
        qaWalkLastProgressPos.current.set(pos.x, pos.y, pos.z);
      }

      const chunkCenterX = getQaSurvivalChunkCenter(pos.x);
      const chunkCenterZ = getQaSurvivalChunkCenter(pos.z);
      const localFromCenterX = pos.x - chunkCenterX;
      const localFromCenterZ = pos.z - chunkCenterZ;
      const maxLocalDistance = Math.max(Math.abs(localFromCenterX), Math.abs(localFromCenterZ));
      qaPosition.set(pos.x, pos.y, pos.z);
      const lilyCoilTubeQaActive = isInLilyCoilTubeChunk(qaPosition, storeState.gameMode);
      const lilyCoilTubeTravelState = lilyCoilTubeQaActive ? getNearestLilyCoilTubeState(qaPosition, lilyCoilNearestScratch) : null;
      const qaSpellDummyRunActive = isQaSpellDummyRunEnabled();
      const qaRouteWaypoints = getQaSurvivalRouteWaypoints();
      const qaRouteActive = qaRouteWaypoints.length > 0 && !lilyCoilTubeQaActive && !qaSpellDummyRunActive;
      if (qaRouteActive) {
        if (!isSurvivalWalkBotwGrassUploadReady() && qaTravelElapsed < 12) {
          qaWalkInputState.current = { forward: 0, strafe: 0, sprint: false, mode: "travel" };
          publishSurvivalWalkStationaryInput("warmup", "grass-warmup");
          return;
        }
      }
      if (lilyCoilTubeTravelState) {
        if (qaWalkLilyTubeDirection.current >= 0 && lilyCoilTubeTravelState.t > QA_LILY_COIL_TUBE_REVERSE_EDGE_T) {
          qaWalkLilyTubeDirection.current = -1;
        } else if (qaWalkLilyTubeDirection.current < 0 && lilyCoilTubeTravelState.t < QA_LILY_COIL_TUBE_RESTART_EDGE_T) {
          qaWalkLilyTubeDirection.current = 1;
        }
      }
      const setLilyCoilTubeWaypoint = () => {
        if (!lilyCoilTubeQaActive) return false;
        const nearestTube = lilyCoilTubeTravelState ?? getNearestLilyCoilTubeState(qaPosition, lilyCoilNearestScratch);
        const noise = survivalishTurnNoise(pos.x + 317, pos.z - 241, elapsed * 0.21);
        const direction = qaWalkLilyTubeDirection.current >= 0 ? 1 : -1;
        const targetT = THREE.MathUtils.clamp(
          nearestTube.t + direction * (QA_LILY_COIL_TUBE_LOOK_AHEAD_T + (noise - 0.5) * 0.014),
          0.02,
          0.98,
        );
        const targetFrame = getLilyCoilTubeFrameInto(targetT, lilyCoilLookFrame);
        qaWalkWaypoint.current = {
          x: targetFrame.center.x,
          z: targetFrame.center.z,
          expiresAt: elapsed + randomRangeFromNoise(noise, 2.4, 4.1),
        };
        return true;
      };
      const isBaseVillageQaArea =
        Math.abs(chunkCenterX) < 1 &&
        Math.abs(chunkCenterZ) < 1 &&
        Math.max(Math.abs(pos.x), Math.abs(pos.z)) < QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT + 54;
      const isDarrelGroveQaArea =
        Math.abs(chunkCenterX - DARREL_QUEST_CHUNK.cx * SURVIVAL_BLOCK_SIZE) < 1 &&
        Math.abs(chunkCenterZ - DARREL_QUEST_CHUNK.cz * SURVIVAL_BLOCK_SIZE) < 1;
      const setDarrelGroveWaypoint = () => {
        if (!isDarrelGroveQaArea) return false;

        const noiseA = survivalishTurnNoise(pos.x + 73, pos.z - 29, elapsed * 0.31);
        const noiseB = survivalishTurnNoise(pos.x - 111, pos.z + 53, elapsed * 0.27);
        const orbit = noiseA * Math.PI * 2;
        const radiusX = randomRangeFromNoise(noiseB, 26, 72);
        const radiusZ = randomRangeFromNoise(noiseA, 14, 42);
        const localTargetX = THREE.MathUtils.clamp(
          QA_DARREL_GROVE_CLEARING_LOCAL_X + Math.cos(orbit) * radiusX,
          -118,
          146,
        );
        const localTargetZ = THREE.MathUtils.clamp(
          QA_DARREL_GROVE_CLEARING_LOCAL_Z + Math.sin(orbit) * radiusZ,
          152,
          218,
        );
        qaWalkWaypoint.current = {
          x: chunkCenterX + localTargetX,
          z: chunkCenterZ + localTargetZ,
          expiresAt: elapsed + randomRangeFromNoise(noiseB, 4.6, 7.4),
        };
        return true;
      };
      const getDarrelGroveRescuePosition = () => {
        if (!isDarrelGroveQaArea) return null;
        const followingDarrelDragonRoute = qaWalkIntent.current?.kind === "darrel-dragon";
        const inRiverBridgePocket =
          localFromCenterZ > 72 &&
          localFromCenterZ < 148 &&
          Math.abs(localFromCenterX) < 142;
        const underHouseOrRoof =
          localFromCenterZ > -64 &&
          localFromCenterZ < 72 &&
          Math.abs(localFromCenterX) < 96;
        const belowClearWalkingSurface = pos.y < 12;
        if (followingDarrelDragonRoute && !belowClearWalkingSurface) return null;
        if (!inRiverBridgePocket && !underHouseOrRoof && !belowClearWalkingSurface) return null;
        return {
          x: chunkCenterX + QA_DARREL_GROVE_CLEARING_LOCAL_X,
          y: QA_DARREL_GROVE_RESCUE_Y,
          z: chunkCenterZ + QA_DARREL_GROVE_CLEARING_LOCAL_Z,
        };
      };
      const getDarrelDragonRouteAssistPosition = () => {
        if (!isDarrelGroveQaArea || qaWalkIntent.current?.kind !== "darrel-dragon") return null;
        const inSideSnagPocket =
          Math.abs(localFromCenterX) > 58 &&
          Math.abs(localFromCenterX) < 112 &&
          localFromCenterZ > 36 &&
          localFromCenterZ < 82 &&
          pos.y > 12;
        const inPorchSnagPocket =
          Math.abs(localFromCenterX) > 18 &&
          Math.abs(localFromCenterX) < 48 &&
          localFromCenterZ > -62 &&
          localFromCenterZ < -34 &&
          pos.y > 24;
        if (inPorchSnagPocket || inSideSnagPocket) {
          return {
            x: chunkCenterX,
            y: QA_DARREL_GROVE_RESCUE_Y,
            z: chunkCenterZ + QA_DARREL_GROVE_DRAGON_DOOR_Z,
          };
        }
        return null;
      };
      const setBaseVillageRoadWaypoint = () => {
        if (!isBaseVillageQaArea) return false;

        const absX = Math.abs(pos.x);
        const absZ = Math.abs(pos.z);
        const onVerticalRoad = absX <= QA_BASE_VILLAGE_ROAD_HALF_WIDTH;
        const onHorizontalRoad = absZ <= QA_BASE_VILLAGE_ROAD_HALF_WIDTH;
        const noise = survivalishTurnNoise(pos.x + 19, pos.z - 37, elapsed * 0.41);
        const distance = randomRangeFromNoise(
          survivalishTurnNoise(pos.x - 27, pos.z + 11, elapsed * 0.23),
          QA_SURVIVAL_WAYPOINT_MIN_DISTANCE * 0.68,
          QA_SURVIVAL_WAYPOINT_MAX_DISTANCE * 0.72,
        );
        let targetX = pos.x;
        let targetZ = pos.z;

        if (!onVerticalRoad && !onHorizontalRoad) {
          if (absX < absZ) {
            targetX = 0;
            targetZ = THREE.MathUtils.clamp(pos.z, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT);
          } else {
            targetX = THREE.MathUtils.clamp(pos.x, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT);
            targetZ = 0;
          }
        } else if (onVerticalRoad && (!onHorizontalRoad || noise < 0.58)) {
          const forwardZ = -Math.cos(qaWalkYaw.current ?? currentYaw);
          const direction = pos.z > QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT * 0.7
            ? -1
            : pos.z < -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT * 0.7
              ? 1
              : (Math.abs(forwardZ) > 0.22 ? Math.sign(forwardZ) : (noise > 0.5 ? 1 : -1));
          targetX = 0;
          targetZ = THREE.MathUtils.clamp(pos.z + direction * distance, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT);
        } else {
          const forwardX = Math.sin(qaWalkYaw.current ?? currentYaw);
          const direction = pos.x > QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT * 0.7
            ? -1
            : pos.x < -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT * 0.7
              ? 1
              : (Math.abs(forwardX) > 0.22 ? Math.sign(forwardX) : (noise > 0.5 ? 1 : -1));
          targetX = THREE.MathUtils.clamp(pos.x + direction * distance, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT);
          targetZ = 0;
        }

        qaWalkWaypoint.current = {
          x: targetX,
          z: targetZ,
          expiresAt: elapsed + randomRangeFromNoise(noise, 4.8, 8.2),
        };
        return true;
      };
      const getBaseVillageRoadRescuePosition = () => {
        if (!isBaseVillageQaArea) return null;
        const absX = Math.abs(pos.x);
        const absZ = Math.abs(pos.z);
        if (absX <= QA_BASE_VILLAGE_ROAD_HALF_WIDTH || absZ <= QA_BASE_VILLAGE_ROAD_HALF_WIDTH) return null;
        if (absX < absZ) {
          return {
            x: 0,
            y: pos.y + 0.28,
            z: THREE.MathUtils.clamp(pos.z, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT),
          };
        }
        return {
          x: THREE.MathUtils.clamp(pos.x, -QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT, QA_BASE_VILLAGE_ROAD_TRAVEL_LIMIT),
          y: pos.y + 0.28,
          z: 0,
        };
      };
      const setRouteWaypoint = () => {
        const routeSelection = resolveQaWalkRouteWaypoint({
          active: qaRouteActive,
          elapsedSeconds: elapsed,
          position: pos,
          routeIndex: qaWalkRouteIndex.current,
          waypoints: qaRouteWaypoints,
        });
        if (!routeSelection) return false;
        qaWalkIntent.current = null;
        qaWalkInspectUntil.current = 0;
        qaWalkNextInspectAt.current = elapsed + 999;
        qaWalkRouteIndex.current = routeSelection.routeIndex;
        qaWalkWaypoint.current = routeSelection.waypoint;
        return true;
      };
      const intentDistance = (intent: QaSurvivalIntent | null) => intent
        ? Math.sqrt((intent.x - pos.x) * (intent.x - pos.x) + (intent.z - pos.z) * (intent.z - pos.z))
        : Number.POSITIVE_INFINITY;
      const getIntentMoveTarget = (intent: QaSurvivalIntent) => {
        if (intent.kind !== "darrel-dragon" || !isDarrelGroveQaArea) return intent;

        const localX = pos.x - chunkCenterX;
        const localZ = pos.z - chunkCenterZ;
        const routeSide = localX >= 0 ? 1 : -1;
        const stage = (x: number, z: number) => ({
          x: chunkCenterX + x,
          y: intent.y,
          z: chunkCenterZ + z,
        });

        if (localZ > QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z + 14) {
          return stage(
            routeSide * QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_X,
            QA_DARREL_GROVE_DRAGON_SIDE_APPROACH_Z,
          );
        }
        if (
          Math.abs(localX) > QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X + 12 ||
          localZ < QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z - 16
        ) {
          return stage(
            routeSide * QA_DARREL_GROVE_DRAGON_SIDE_STAIR_X,
            QA_DARREL_GROVE_DRAGON_SIDE_STAIR_Z,
          );
        }
        if (Math.abs(localX) > 18 || localZ < QA_DARREL_GROVE_DRAGON_DOOR_Z - 8) {
          return stage(0, QA_DARREL_GROVE_DRAGON_DOOR_Z);
        }
        return intent;
      };
      const intentCompletionDistance = (intent: QaSurvivalIntent) => {
        if (intent.kind === "mana-flower") {
          let flowerRadius = 0;
          for (const flower of getReadyQaManaFlowers()) {
            if (flower.id === intent.id) {
              flowerRadius = flower.radius;
              break;
            }
          }
          return Math.max(QA_INTENT_MANA_COLLECT_RADIUS, 1.2 + flowerRadius);
        }
        if (intent.kind === "spell-dummy") return QA_INTENT_DUMMY_KEEP_DISTANCE;
        if (intent.kind === "darrel-dragon") return QA_DARREL_GROVE_DRAGON_INTERACT_DISTANCE;
        return QA_INTENT_INTERACT_DISTANCE;
      };
      const setIntentWaypoint = (intent: QaSurvivalIntent) => {
        qaWalkWaypoint.current = {
          x: intent.x,
          z: intent.z,
          expiresAt: Math.min(intent.expiresAt, elapsed + 3.8),
        };
      };
      const makeIntent = (
        kind: QaSurvivalIntentKind,
        id: string,
        label: string,
        target: { x: number; y: number; z: number },
        durationSeconds = QA_INTENT_INTEREST_STALE_SECONDS,
      ): QaSurvivalIntent => ({
        kind,
        id,
        label,
        x: target.x,
        y: target.y,
        z: target.z,
        expiresAt: elapsed + durationSeconds,
        observeUntil: elapsed + QA_INTENT_OBSERVE_SECONDS,
      });
      const scoreInterest = (id: string, score: number) => {
        const lastSeen = qaWalkInterestMemory.current[id] ?? -Infinity;
        return elapsed - lastSeen < QA_INTENT_INTEREST_STALE_SECONDS ? score - 16 : score;
      };
      const maybeChooseIntent = (force = false) => {
        const spellDummiesForIntent = getQaSpellDummies();
        let shouldPrioritizeDummies = false;
        if (qaSpellDummyRunActive) {
          for (const dummy of spellDummiesForIntent) {
            if (dummy.health > 0) {
              shouldPrioritizeDummies = true;
              break;
            }
          }
        }
        const current = qaWalkIntent.current;
        let currentDummy: (typeof spellDummiesForIntent)[number] | null = null;
        if (current?.kind === "spell-dummy") {
          for (const dummy of spellDummiesForIntent) {
            if (dummy.id === current.id) {
              currentDummy = dummy;
              break;
            }
          }
        }
        const abandonCurrentDummy = qaSpellDummyRunActive && current?.kind === "spell-dummy" && (
          !currentDummy ||
          currentDummy.health <= 38 ||
          intentDistance(current) > QA_SURVIVAL_COMBAT_TARGET_RANGE * 1.05
        );
        if (
          current &&
          elapsed < current.expiresAt &&
          intentDistance(current) > intentCompletionDistance(current) &&
          !(shouldPrioritizeDummies && current.kind === "mana-flower") &&
          !abandonCurrentDummy
        ) {
          setIntentWaypoint(current);
          return current;
        }

        let bestIntent: QaSurvivalIntent | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        const consider = (intent: QaSurvivalIntent, score: number) => {
          const adjustedScore = scoreInterest(`${intent.kind}:${intent.id}`, score);
          if (adjustedScore > bestScore) {
            bestIntent = intent;
            bestScore = adjustedScore;
          }
        };

        const lowestRunePower = Math.min(storeState.leftRunePower, storeState.rightRunePower);
        const needsMana = shouldPrioritizeDummies ? false : lowestRunePower < QA_INTENT_MANA_LOW_THRESHOLD;
        const manaRangeSq = QA_INTENT_MANA_RANGE * QA_INTENT_MANA_RANGE;
        for (const flower of getReadyQaManaFlowers()) {
          if (shouldPrioritizeDummies && !needsMana) continue;
          const distanceX = flower.x - pos.x;
          const distanceZ = flower.z - pos.z;
          const distanceSq = distanceX * distanceX + distanceZ * distanceZ;
          if (distanceSq > manaRangeSq) continue;
          const distance = Math.sqrt(distanceSq);
          const urgency = needsMana ? 46 : 14;
          consider(
            makeIntent("mana-flower", flower.id, "mana flower", { x: flower.x, y: flower.y, z: flower.z }, needsMana ? 15 : 8),
            urgency - distance / 26,
          );
        }

        const dummyIntentRange = qaSpellDummyRunActive ? QA_INTENT_DUMMY_TEST_RANGE : QA_INTENT_DUMMY_RANGE;
        const dummyIntentRangeSq = dummyIntentRange * dummyIntentRange;
        for (const dummy of spellDummiesForIntent) {
          const distanceX = dummy.position.x - pos.x;
          const distanceZ = dummy.position.z - pos.z;
          const distanceSq = distanceX * distanceX + distanceZ * distanceZ;
          if (distanceSq > dummyIntentRangeSq) continue;
          const distance = Math.sqrt(distanceSq);
          const healthScore = THREE.MathUtils.clamp(dummy.health / 7, 0, 18);
          const woundedPenalty = qaSpellDummyRunActive && dummy.health <= 38 ? 20 : 0;
          consider(
            makeIntent("spell-dummy", dummy.id, `dummy ${Math.round(dummy.health)}`, dummy.position, qaSpellDummyRunActive ? 24 : 10),
            (qaSpellDummyRunActive ? 104 - distance / 16 : 52 - distance / 9) + healthScore - woundedPenalty,
          );
        }

        const questIntentRangeSq = QA_INTENT_QUEST_RANGE * QA_INTENT_QUEST_RANGE;
        for (const target of getQuestNavigationIntentTargets()) {
          const distanceX = target.x - pos.x;
          const distanceZ = target.z - pos.z;
          const distanceSq = distanceX * distanceX + distanceZ * distanceZ;
          if (distanceSq > questIntentRangeSq) continue;
          const distance = Math.sqrt(distanceSq);
          consider(
            makeIntent("quest-target", target.id, target.label, { x: target.x, y: target.y, z: target.z }, 18),
            42 - distance / 22,
          );
        }

        if (isDarrelGroveQaArea) {
          const dragonDistanceX = DARREL_DRAGON_WORLD_POSITION.x - pos.x;
          const dragonDistanceZ = DARREL_DRAGON_WORLD_POSITION.z - pos.z;
          const dragonDistance = Math.sqrt(dragonDistanceX * dragonDistanceX + dragonDistanceZ * dragonDistanceZ);
          consider(
            makeIntent("darrel-dragon", "darrel-dragon", "spirit dragon", DARREL_DRAGON_WORLD_POSITION, QA_DARREL_GROVE_DRAGON_INTENT_SECONDS),
            QA_DARREL_GROVE_DRAGON_INTEREST_SCORE - dragonDistance / 14,
          );
        }

        if (!bestIntent || bestScore < 8) {
          qaWalkIntent.current = null;
          return null;
        }

        qaWalkIntent.current = bestIntent;
        qaWalkNextIntentAt.current = elapsed + randomRangeFromNoise(
          survivalishTurnNoise(bestIntent.x, bestIntent.z, elapsed),
          QA_INTENT_REPLAN_MIN_SECONDS,
          QA_INTENT_REPLAN_MAX_SECONDS,
        );
        qaWalkInterestMemory.current[`${bestIntent.kind}:${bestIntent.id}`] = elapsed;
        setIntentWaypoint(bestIntent);
        return bestIntent;
      };
      const chooseNewWaypoint = (preferCenter = false) => {
        if (setLilyCoilTubeWaypoint()) return;
        if (setRouteWaypoint()) return;
        const shouldPrioritizeDummyIntent = qaSpellDummyRunActive && getQaSpellDummies().length > 0;
        if ((!preferCenter || shouldPrioritizeDummyIntent) && maybeChooseIntent(shouldPrioritizeDummyIntent || elapsed >= qaWalkNextIntentAt.current)) return;
        if (setDarrelGroveWaypoint()) return;
        if (setBaseVillageRoadWaypoint()) return;

        const noiseA = survivalishTurnNoise(pos.x + elapsed * 3.7, pos.z - elapsed * 2.9, elapsed * 0.31);
        const noiseB = survivalishTurnNoise(pos.x - 41.7, pos.z + 19.3, elapsed * 0.23);
        const noiseC = survivalishTurnNoise(pos.x + 7.9, pos.z - 13.1, elapsed * 0.17);
        const edgePressure = THREE.MathUtils.clamp((maxLocalDistance - SURVIVAL_BLOCK_SIZE * 0.34) / (SURVIVAL_BLOCK_SIZE * 0.18), 0, 1);
        const centerYaw = Math.atan2(chunkCenterX - pos.x, -(chunkCenterZ - pos.z));
        const roamYaw = (qaWalkYaw.current ?? currentYaw) + (noiseA - 0.5) * 1.85;
        const waypointYaw = preferCenter || edgePressure > 0
          ? lerpAngleRadians(roamYaw, centerYaw, preferCenter ? 0.82 : edgePressure * 0.72)
          : roamYaw;
        const distance = randomRangeFromNoise(noiseB, QA_SURVIVAL_WAYPOINT_MIN_DISTANCE, QA_SURVIVAL_WAYPOINT_MAX_DISTANCE);
        const sideOffset = (noiseC - 0.5) * 70;
        const forwardX = Math.sin(waypointYaw);
        const forwardZ = -Math.cos(waypointYaw);
        const rightX = Math.cos(waypointYaw);
        const rightZ = Math.sin(waypointYaw);
        qaWalkWaypoint.current = {
          x: pos.x + forwardX * distance + rightX * sideOffset,
          z: pos.z + forwardZ * distance + rightZ * sideOffset,
          expiresAt: elapsed + randomRangeFromNoise(noiseC, 6.5, 13.5),
        };
      };

      const setForwardQaWaypoint = (yaw: number, distance = QA_SURVIVAL_WAYPOINT_MIN_DISTANCE * 1.15) => {
        qaWalkWaypoint.current = {
          x: pos.x + Math.sin(yaw) * distance,
          z: pos.z - Math.cos(yaw) * distance,
          expiresAt: elapsed + 5.8,
        };
      };

      const waypointDistanceX = qaWalkWaypoint.current.x - pos.x;
      const waypointDistanceZ = qaWalkWaypoint.current.z - pos.z;
      const waypointDistanceSq = waypointDistanceX * waypointDistanceX + waypointDistanceZ * waypointDistanceZ;
      const waypointDistance = Math.sqrt(waypointDistanceSq);
      const waypointReachDistance = qaRouteActive ? QA_SURVIVAL_ROUTE_REACH_DISTANCE : 18;
      if (
        elapsed >= qaWalkWaypoint.current.expiresAt ||
        waypointDistanceSq < waypointReachDistance * waypointReachDistance ||
        (!qaRouteActive && maxLocalDistance > SURVIVAL_BLOCK_SIZE * 0.48)
      ) {
        chooseNewWaypoint(!qaRouteActive && maxLocalDistance > SURVIVAL_BLOCK_SIZE * 0.48);
      }
      if (qaRouteActive) {
        qaWalkIntent.current = null;
      }
      let activeIntent = !qaRouteActive && qaWalkIntent.current && elapsed < qaWalkIntent.current.expiresAt ? qaWalkIntent.current : null;
      if (!activeIntent && qaWalkIntent.current) {
        qaWalkIntent.current = null;
      }
      if (!activeIntent && qaSpellDummyRunActive && getQaSpellDummies().length > 0) {
        activeIntent = maybeChooseIntent(true);
      }
      let hasActiveSpellDummy = false;
      if (activeIntent?.kind === "mana-flower" && qaSpellDummyRunActive) {
        for (const dummy of getQaSpellDummies()) {
          if (dummy.health > 0) {
            hasActiveSpellDummy = true;
            break;
          }
        }
      }
      if (
        activeIntent?.kind === "mana-flower" &&
        qaSpellDummyRunActive &&
        hasActiveSpellDummy
      ) {
        qaWalkIntent.current = null;
        qaWalkNextIntentAt.current = 0;
        activeIntent = maybeChooseIntent(true);
      }
      if (activeIntent?.kind === "spell-dummy") {
        let liveDummy: ReturnType<typeof getQaSpellDummies>[number] | null = null;
        for (const dummy of getQaSpellDummies()) {
          if (dummy.id === activeIntent.id) {
            liveDummy = dummy;
            break;
          }
        }
        if (liveDummy) {
          activeIntent = {
            ...activeIntent,
            x: liveDummy.position.x,
            y: liveDummy.position.y,
            z: liveDummy.position.z,
          };
          qaWalkIntent.current = activeIntent;
        } else if (qaSpellDummyRunActive) {
          qaWalkIntent.current = null;
          qaWalkNextIntentAt.current = 0;
          activeIntent = maybeChooseIntent(true);
        }
      }
      const activeIntentDistance = intentDistance(activeIntent);

      if (
        !lilyCoilTubeQaActive &&
        !qaRouteActive &&
        !qaWalkIntent.current &&
        (!qaSpellDummyRunActive || getQaSpellDummies().length <= 0) &&
        elapsed >= qaWalkNextInspectAt.current &&
        elapsed >= qaWalkInspectUntil.current &&
        elapsed > qaWalkRecoveryUntil.current + 2.5 &&
        qaWalkStuckStrikes.current <= 1
      ) {
        const inspectNoise = survivalishTurnNoise(pos.x + 103, pos.z - 59, elapsed);
        qaWalkInspectUntil.current = elapsed + randomRangeFromNoise(
          inspectNoise,
          QA_SURVIVAL_INSPECTION_MIN_SECONDS,
          QA_SURVIVAL_INSPECTION_MAX_SECONDS,
        );
        qaWalkInspectYaw.current = (qaWalkYaw.current ?? currentYaw) + randomRangeFromNoise(inspectNoise, -0.85, 0.85);
        qaWalkNextInspectAt.current = qaWalkInspectUntil.current + randomRangeFromNoise(
          survivalishTurnNoise(pos.x - 17, pos.z + 97, elapsed * 0.4),
          QA_SURVIVAL_INSPECTION_MIN_INTERVAL,
          QA_SURVIVAL_INSPECTION_MAX_INTERVAL,
        );
      }

      let desiredYaw = Math.atan2(qaWalkWaypoint.current.x - pos.x, -(qaWalkWaypoint.current.z - pos.z));
      let lilyCoilTubeTravelYaw: number | null = null;
      if (lilyCoilTubeTravelState) {
        const direction = qaWalkLilyTubeDirection.current >= 0 ? 1 : -1;
        const lookT = THREE.MathUtils.clamp(
          lilyCoilTubeTravelState.t + direction * QA_LILY_COIL_TUBE_LOOK_AHEAD_T,
          0.02,
          0.98,
        );
        const lookFrame = getLilyCoilTubeFrameInto(lookT, lilyCoilLookFrame);
        const travelTangent = frameForward.copy(lookFrame.tangent).multiplyScalar(direction).normalize();
        lilyCoilTubeTravelYaw = Math.atan2(travelTangent.x, -travelTangent.z);
        desiredYaw = lilyCoilTubeTravelYaw;
      }

      const probeClearance = (yaw: number, distance: number) => {
        let clearance = distance;
        for (const height of QA_SURVIVAL_WALK_PROBE_HEIGHTS) {
          const ray = new rapier.Ray(
            { x: pos.x, y: pos.y + height, z: pos.z },
            { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) },
          );
          // @ts-ignore - rapier exposes the collider predicate in this overload.
          const hit = castPlayerWorldRay(world, ray, distance, true, playerQueryOptions);
          if (hit) clearance = Math.min(clearance, hit.timeOfImpact);
        }
        return clearance;
      };

      const probeViewClearance = (yaw: number, distance: number) => {
        const ray = new rapier.Ray(
          { x: pos.x, y: pos.y + PLAYER_CAMERA_HEIGHT * 0.86, z: pos.z },
          { x: Math.sin(yaw), y: 0, z: -Math.cos(yaw) },
        );
        // @ts-ignore - rapier exposes the collider predicate in this overload.
        const hit = castPlayerWorldRay(world, ray, distance, true, playerQueryOptions);
        return hit ? hit.timeOfImpact : distance;
      };

      const probeOverheadClearance = () => {
        const ray = new rapier.Ray(
          { x: pos.x, y: pos.y + PLAYER_CAMERA_HEIGHT * 0.34, z: pos.z },
          { x: 0, y: 1, z: 0 },
        );
        // @ts-ignore - rapier exposes the collider predicate in this overload.
        const hit = castPlayerWorldRay(world, ray, QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE, true, playerQueryOptions);
        return hit ? hit.timeOfImpact : QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE;
      };

      const scoreCandidateYaw = (candidateYaw: number, turn: number) => {
        const center = probeClearance(candidateYaw, QA_SURVIVAL_WALK_PROBE_DISTANCE);
        const left = probeClearance(candidateYaw + 0.34, QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE);
        const right = probeClearance(candidateYaw - 0.34, QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE);
        const lookAhead = probeClearance(candidateYaw, QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE);
        const directionAgreement = Math.cos(candidateYaw - desiredYaw) * 3.15;
        const turnPenalty = Math.abs(turn) * 0.85;
        const deadEndPenalty = lookAhead < QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE * 0.42 ? 16 : 0;
        return {
          yaw: candidateYaw,
          center,
          left,
          right,
          lookAhead,
          score: center * 1.15 + Math.min(left, right) * 0.72 + Math.min(lookAhead, 32) * 0.58 + directionAgreement - turnPenalty - deadEndPenalty,
        };
      };

      const findEscapeYaw = (baseYaw: number, preferYaw: number) => {
        let best = {
          yaw: baseYaw + Math.PI,
          center: 0,
          left: 0,
          right: 0,
          lookAhead: 0,
          score: Number.NEGATIVE_INFINITY,
        };
        const evaluate = (candidateYaw: number, preferWeight: number) => {
          const center = probeClearance(candidateYaw, QA_SURVIVAL_WALK_PROBE_DISTANCE * 1.15);
          const left = probeClearance(candidateYaw + 0.42, QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE * 1.1);
          const right = probeClearance(candidateYaw - 0.42, QA_SURVIVAL_WALK_SIDE_PROBE_DISTANCE * 1.1);
          const lookAhead = probeClearance(candidateYaw, QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE);
          const desiredBias = Math.cos(candidateYaw - preferYaw) * preferWeight;
          const currentTurn = Math.abs(angleDeltaRadians(baseYaw, candidateYaw));
          const turnPenalty = currentTurn > 2.75 ? 0.25 : currentTurn * 0.08;
          const deadEndPenalty = lookAhead < QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE * 0.36 ? 12 : 0;
          const score = center * 1.55 + Math.min(left, right) * 0.84 + Math.max(left, right) * 0.18 + Math.min(lookAhead, 34) * 0.64 + desiredBias - turnPenalty - deadEndPenalty;
          if (score > best.score) {
            best = { yaw: candidateYaw, center, left, right, lookAhead, score };
          }
        };

        evaluate(preferYaw, 1.45);
        evaluate(baseYaw + Math.PI, 0.35);
        for (let turnIndex = 0; turnIndex < QA_SURVIVAL_WALK_ESCAPE_TURNS.length; turnIndex += 1) {
          evaluate(baseYaw + QA_SURVIVAL_WALK_ESCAPE_TURNS[turnIndex], 0.75);
        }
        for (let turnIndex = 0; turnIndex < QA_SURVIVAL_WALK_TURN_OPTIONS.length; turnIndex += 1) {
          evaluate(preferYaw + QA_SURVIVAL_WALK_TURN_OPTIONS[turnIndex], 1.05);
        }
        return best;
      };

      const beginQaWalkRecovery = (aggressive = false) => {
        if (aggressive) chooseNewWaypoint(true);
        const baseYaw = qaWalkYaw.current ?? currentYaw;
        const preferYaw = Math.atan2(qaWalkWaypoint.current.x - pos.x, -(qaWalkWaypoint.current.z - pos.z));
        const escape = findEscapeYaw(baseYaw, preferYaw);
        const durationNoise = survivalishTurnNoise(pos.x + 31, pos.z - 83, elapsed + qaWalkStuckStrikes.current * 1.7);
        const strikeBonus = Math.min(qaWalkStuckStrikes.current, 4) * 0.22;
        qaWalkRecoveryStartedAt.current = elapsed;
        qaWalkRecoveryStartPos.current.set(pos.x, pos.y, pos.z);
        qaWalkRecoveryUntil.current = elapsed + randomRangeFromNoise(
          durationNoise,
          QA_SURVIVAL_RECOVERY_MIN_SECONDS + strikeBonus,
          QA_SURVIVAL_RECOVERY_MAX_SECONDS + strikeBonus,
        );
        qaWalkRecoveryYaw.current = escape.yaw;
        const strafe = THREE.MathUtils.clamp((escape.right - escape.left) * 0.12, -0.72, 0.72);
        qaWalkRecoveryStrafe.current = Math.abs(strafe) > 0.12
          ? strafe
          : (survivalishTurnNoise(pos.x - 7, pos.z + 19, elapsed) > 0.5 ? 0.46 : -0.46);
        qaWalkInspectUntil.current = 0;
        qaWalkLastDecisionAt.current = elapsed;
        qaWalkNextDecisionAt.current = elapsed + randomRangeFromNoise(durationNoise, 1.15, 2.35);
      };

      const measuredForwardClearance = probeClearance(qaWalkYaw.current, QA_SURVIVAL_WALK_PROBE_DISTANCE);
      const measuredForwardLookAhead = probeClearance(qaWalkYaw.current, QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE);
      const measuredViewClearance = probeViewClearance(qaWalkYaw.current, QA_SURVIVAL_VIEW_SOFT_CLEARANCE);
      const measuredOverheadClearance = probeOverheadClearance();
      const forwardClearance = lilyCoilTubeQaActive ? QA_SURVIVAL_WALK_PROBE_DISTANCE : measuredForwardClearance;
      const forwardLookAhead = lilyCoilTubeQaActive ? QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE : measuredForwardLookAhead;
      const viewClearance = lilyCoilTubeQaActive ? QA_SURVIVAL_VIEW_SOFT_CLEARANCE : measuredViewClearance;
      const overheadClearance = lilyCoilTubeQaActive ? QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE : measuredOverheadClearance;
      const routeSteering = resolveQaWalkRouteSteeringState({
        active: qaRouteActive,
        elapsedSeconds: elapsed,
        deltaSeconds: delta,
        routeBlockedSince: qaWalkRouteBlockedSince.current,
        routeTargetId: qaRouteActive
          ? qaRouteWaypoints[qaWalkRouteIndex.current % qaRouteWaypoints.length]?.id ?? null
          : null,
        previousRouteTargetId: qaWalkRouteTargetId.current,
        previousSmoothedYaw: qaWalkRouteSmoothedYaw.current,
        desiredYaw,
        forwardClearance,
        forwardLookAhead,
        viewClearance,
        overheadClearance,
      });
      qaWalkRouteBlockedSince.current = routeSteering.routeBlockedSince;
      const routeHardBlocked = routeSteering.routeHardBlocked;
      const routeBlockDwelled = routeSteering.routeBlockDwelled;
      let mode: QaSurvivalWalkMode = qaRouteActive ? "route" : "travel";
      let targetYaw = desiredYaw
        + Math.sin(elapsed * 0.43 + pos.x * 0.002) * 0.14
        + Math.sin(elapsed * 0.91 + pos.z * 0.0014) * 0.05;
      let forwardAmount = 0.58 + Math.sin(elapsed * 0.47 + pos.z * 0.001) * 0.12;
      let strafeAmount = Math.sin(elapsed * 0.62 + pos.x * 0.003 + pos.z * 0.002) * 0.16;
      let recoveryReason = "";
      let sprint = forwardClearance > QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.68
        && forwardLookAhead > QA_SURVIVAL_WALK_SOFT_LOOKAHEAD
        && viewClearance > QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.72
        && Math.sin(elapsed * 0.29 + pos.x * 0.0017) > -0.18;
      if (routeSteering.route) {
        qaWalkRouteSmoothedYaw.current = routeSteering.route.smoothedYaw;
        qaWalkRouteTargetId.current = routeSteering.route.targetId;
        targetYaw = routeSteering.route.targetYaw;
        forwardAmount = routeSteering.route.forwardAmount;
        strafeAmount = routeSteering.route.strafeAmount;
        sprint = routeSteering.route.sprint;
      } else {
        qaWalkRouteSmoothedYaw.current = null;
        qaWalkRouteTargetId.current = null;
      }
      if (lilyCoilTubeTravelYaw !== null) {
        const tubeDirection = qaWalkLilyTubeDirection.current >= 0 ? 1 : -1;
        targetYaw = lilyCoilTubeTravelYaw + Math.sin(elapsed * 0.48 + pos.y * 0.006) * 0.1;
        forwardAmount = tubeDirection * (QA_LILY_COIL_TUBE_FORWARD + Math.sin(elapsed * 0.21 + pos.x * 0.001) * 0.06);
        strafeAmount = Math.sin(elapsed * 0.53 + (lilyCoilTubeTravelState?.t ?? 0) * 22) * QA_LILY_COIL_TUBE_STRAFE;
        sprint = true;
      }

      const needsDecision = !lilyCoilTubeQaActive && (qaRouteActive
        ? routeBlockDwelled
        : (
          forwardClearance < QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.72 ||
          forwardLookAhead < QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE * 0.48 ||
          viewClearance < QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.68 ||
          overheadClearance < QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE ||
          elapsed >= qaWalkNextDecisionAt.current ||
          elapsed - qaWalkLastDecisionAt.current > QA_SURVIVAL_WALK_DECISION_MAX_SECONDS
        )
      );

      if (needsDecision) {
        let best = scoreCandidateYaw(targetYaw, 0);

        for (let index = 0; index < QA_SURVIVAL_WALK_TURN_OPTIONS.length; index += 1) {
          const turn = QA_SURVIVAL_WALK_TURN_OPTIONS[index];
          const candidateYaw = desiredYaw + turn + (index === 0 ? Math.sin(elapsed * 0.37) * 0.22 : 0);
          const candidate = scoreCandidateYaw(candidateYaw, turn);
          if (candidate.score > best.score) {
            best = candidate;
          }
        }

        targetYaw = best.yaw;
        strafeAmount = qaRouteActive
          ? 0
          : THREE.MathUtils.clamp((best.right - best.left) * 0.09, -0.62, 0.62) + strafeAmount * 0.35;
        qaWalkLastDecisionAt.current = elapsed;
        qaWalkNextDecisionAt.current = elapsed + randomRangeFromNoise(
          survivalishTurnNoise(pos.x - 3.5, pos.z + 8.25, elapsed),
          QA_SURVIVAL_WALK_DECISION_MIN_SECONDS,
          QA_SURVIVAL_WALK_DECISION_MAX_SECONDS,
        );
      }

      if (
        !lilyCoilTubeQaActive &&
        (
          forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE ||
          viewClearance < QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE ||
          overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE
        ) &&
        (!qaRouteActive || (routeHardBlocked && routeBlockDwelled)) &&
        elapsed >= qaWalkRecoveryUntil.current - 0.08
      ) {
        recoveryReason = overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE
          ? "overhead"
          : viewClearance < QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE
            ? "view-blocked"
            : "clearance";
        beginQaWalkRecovery(forwardClearance < 2.4 || viewClearance < 2.2 || overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE);
      }

      if (elapsed < qaWalkInspectUntil.current) {
        mode = "inspect";
        targetYaw = qaWalkInspectYaw.current + Math.sin(elapsed * 1.35) * 0.18;
        forwardAmount = 0;
        strafeAmount = 0;
        sprint = false;
      } else if (
        elapsed < qaWalkRecoveryUntil.current ||
        (
          forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE &&
          (!qaRouteActive || (routeHardBlocked && routeBlockDwelled))
        )
      ) {
        mode = "recover";
        targetYaw = qaWalkRecoveryYaw.current || targetYaw;
        strafeAmount = forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE ? 0 : qaWalkRecoveryStrafe.current;
        const recoveryAge = Math.max(0, elapsed - qaWalkRecoveryStartedAt.current);
        const recoveryDistanceX = pos.x - qaWalkRecoveryStartPos.current.x;
        const recoveryDistanceZ = pos.z - qaWalkRecoveryStartPos.current.z;
        const recoveryDistanceSq = recoveryDistanceX * recoveryDistanceX + recoveryDistanceZ * recoveryDistanceZ;
        const yawError = Math.abs(angleDeltaRadians(qaWalkYaw.current ?? currentYaw, targetYaw));
        const darrelRouteAssistPosition = getDarrelDragonRouteAssistPosition();
        const darrelRescuePosition = getDarrelGroveRescuePosition();
        const roadRescuePosition = qaWalkStuckStrikes.current >= 4 ? getBaseVillageRoadRescuePosition() : null;
        if (darrelRouteAssistPosition && elapsed > qaWalkLastUnstickNudgeAt.current + 0.9) {
          const escapeYaw = Math.atan2(
            DARREL_DRAGON_WORLD_POSITION.x - darrelRouteAssistPosition.x,
            -(DARREL_DRAGON_WORLD_POSITION.z - darrelRouteAssistPosition.z),
          );
          rigidBody.current?.setTranslation(darrelRouteAssistPosition, true);
          rigidBody.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
          camera.position.set(darrelRouteAssistPosition.x, darrelRouteAssistPosition.y + PLAYER_CAMERA_HEIGHT, darrelRouteAssistPosition.z);
          publishLocalPlayerPosition(darrelRouteAssistPosition, { rememberLast: true });
          publishQaPlayerPosition(darrelRouteAssistPosition);
          qaWalkLastUnstickNudgeAt.current = elapsed;
          qaWalkRecoveryStartPos.current.set(darrelRouteAssistPosition.x, darrelRouteAssistPosition.y, darrelRouteAssistPosition.z);
          qaWalkRecoveryStartedAt.current = elapsed;
          qaWalkRecoveryUntil.current = elapsed + 0.18;
          qaWalkRecoveryYaw.current = Number.isFinite(escapeYaw) ? escapeYaw : targetYaw;
          setForwardQaWaypoint(qaWalkRecoveryYaw.current);
          targetYaw = qaWalkRecoveryYaw.current;
          forwardAmount = 0;
          strafeAmount = 0;
          recoveryReason = "darrel-route-assist";
        } else if (darrelRescuePosition && elapsed > qaWalkLastUnstickNudgeAt.current + 0.9) {
          const escapeYaw = Math.atan2(darrelRescuePosition.x - pos.x, -(darrelRescuePosition.z - pos.z));
          rigidBody.current?.setTranslation(darrelRescuePosition, true);
          rigidBody.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
          camera.position.set(darrelRescuePosition.x, darrelRescuePosition.y + PLAYER_CAMERA_HEIGHT, darrelRescuePosition.z);
          publishLocalPlayerPosition(darrelRescuePosition, { rememberLast: true });
          publishQaPlayerPosition(darrelRescuePosition);
          qaWalkLastUnstickNudgeAt.current = elapsed;
          qaWalkRecoveryStartPos.current.set(darrelRescuePosition.x, darrelRescuePosition.y, darrelRescuePosition.z);
          qaWalkRecoveryStartedAt.current = elapsed;
          qaWalkRecoveryUntil.current = elapsed + QA_SURVIVAL_RECOVERY_MIN_SECONDS;
          qaWalkRecoveryYaw.current = Number.isFinite(escapeYaw) ? escapeYaw : targetYaw;
          setForwardQaWaypoint(qaWalkRecoveryYaw.current);
          targetYaw = qaWalkRecoveryYaw.current;
          forwardAmount = 0;
          strafeAmount = 0;
          recoveryReason = "darrel-grove-rescue";
        } else if (roadRescuePosition && elapsed > qaWalkLastUnstickNudgeAt.current + 1.1) {
          const escapeYaw = Math.atan2(roadRescuePosition.x - pos.x, -(roadRescuePosition.z - pos.z));
          rigidBody.current?.setTranslation(roadRescuePosition, true);
          rigidBody.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
          camera.position.set(roadRescuePosition.x, roadRescuePosition.y + PLAYER_CAMERA_HEIGHT, roadRescuePosition.z);
          publishLocalPlayerPosition(roadRescuePosition, { rememberLast: true });
          publishQaPlayerPosition(roadRescuePosition);
          qaWalkLastUnstickNudgeAt.current = elapsed;
          qaWalkRecoveryStartPos.current.set(roadRescuePosition.x, roadRescuePosition.y, roadRescuePosition.z);
          qaWalkRecoveryStartedAt.current = elapsed;
          qaWalkRecoveryUntil.current = elapsed + QA_SURVIVAL_RECOVERY_MIN_SECONDS;
          qaWalkRecoveryYaw.current = Number.isFinite(escapeYaw) ? escapeYaw : targetYaw;
          setForwardQaWaypoint(qaWalkRecoveryYaw.current);
          targetYaw = qaWalkRecoveryYaw.current;
          forwardAmount = 0;
          strafeAmount = 0;
          recoveryReason = "base-road-rescue";
        } else if (
          qaWalkStuckStrikes.current >= 3 &&
          recoveryAge > QA_SURVIVAL_RECOVERY_NUDGE_SECONDS &&
          recoveryDistanceSq < (QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE * 0.62) * (QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE * 0.62) &&
          elapsed > qaWalkLastUnstickNudgeAt.current + 1.1
        ) {
          const escape = findEscapeYaw((qaWalkYaw.current ?? currentYaw) + Math.PI, desiredYaw);
          const nudgeDistance = QA_SURVIVAL_RECOVERY_NUDGE_DISTANCE + Math.min(qaWalkStuckStrikes.current, 6) * 0.8;
          const nudgedPosition = {
            x: pos.x + Math.sin(escape.yaw) * nudgeDistance,
            y: pos.y + 0.18,
            z: pos.z - Math.cos(escape.yaw) * nudgeDistance,
          };
          rigidBody.current?.setTranslation(nudgedPosition, true);
          rigidBody.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
          camera.position.set(nudgedPosition.x, nudgedPosition.y + PLAYER_CAMERA_HEIGHT, nudgedPosition.z);
          publishLocalPlayerPosition(nudgedPosition, { rememberLast: true });
          publishQaPlayerPosition(nudgedPosition);
          qaWalkLastUnstickNudgeAt.current = elapsed;
          qaWalkRecoveryStartPos.current.set(nudgedPosition.x, nudgedPosition.y, nudgedPosition.z);
          qaWalkRecoveryStartedAt.current = elapsed;
          qaWalkRecoveryUntil.current = elapsed + QA_SURVIVAL_RECOVERY_MIN_SECONDS;
          qaWalkRecoveryYaw.current = escape.yaw;
          setForwardQaWaypoint(escape.yaw);
          targetYaw = escape.yaw;
          forwardAmount = 0;
          strafeAmount = 0;
          recoveryReason = "unstick-nudge";
        } else if (recoveryAge < QA_SURVIVAL_RECOVERY_REVERSE_SECONDS || forwardClearance < 2.4) {
          forwardAmount = -0.32;
        } else if (
          recoveryDistanceSq < QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE * QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE &&
          recoveryAge < QA_SURVIVAL_RECOVERY_REVERSE_STUCK_SECONDS
        ) {
          forwardAmount = -0.32;
          strafeAmount = qaWalkRecoveryStrafe.current;
        } else if (
          recoveryAge > QA_SURVIVAL_RECOVERY_CLEAR_EXIT_SECONDS &&
          forwardClearance > QA_SURVIVAL_RECOVERY_CLEAR_EXIT_DISTANCE &&
          recoveryDistanceSq >= QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE * QA_SURVIVAL_RECOVERY_MIN_ESCAPE_DISTANCE
        ) {
          const escapeYaw = qaWalkRecoveryYaw.current || targetYaw;
          qaWalkRecoveryUntil.current = elapsed;
          qaWalkStuckStrikes.current = Math.max(0, qaWalkStuckStrikes.current - 1);
          setForwardQaWaypoint(escapeYaw);
          mode = "travel";
          targetYaw = escapeYaw;
          forwardAmount = 0.62;
          strafeAmount = qaWalkRecoveryStrafe.current * 0.22;
          recoveryReason = "clear-exit";
        } else if (forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE * 0.62) {
          forwardAmount = 0;
          strafeAmount = 0;
        } else if (yawError > QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR) {
          forwardAmount = 0;
          strafeAmount = 0;
        } else {
          forwardAmount = forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE ? 0.22 : 0.56;
        }
        sprint = false;
        if (state.clock.elapsedTime > qaWalkJumpHeldUntil.current + 2.1 && yawError < 0.55 && forwardClearance > 1.6 && forwardClearance < 4.2) {
          qaWalkJumpHeldUntil.current = state.clock.elapsedTime + 0.16;
        }
      } else if (
        !qaRouteActive &&
        (
          forwardClearance < QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.72 ||
          viewClearance < QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.72 ||
          overheadClearance < QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE
        )
      ) {
        mode = "avoid";
        const avoidYawError = Math.abs(angleDeltaRadians(qaWalkYaw.current ?? currentYaw, targetYaw));
        if (avoidYawError > QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR) {
          forwardAmount = 0;
          strafeAmount = 0;
        } else {
          forwardAmount = viewClearance < QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.58 ? 0.18 : 0.38;
          if (overheadClearance < QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE) {
            forwardAmount = Math.min(forwardAmount, 0.22);
          }
          strafeAmount = THREE.MathUtils.clamp(strafeAmount + Math.sign(Math.sin(elapsed * 1.7 + pos.x * 0.01)) * 0.18, -0.58, 0.58);
        }
        sprint = false;
      }

      if (activeIntent && mode === "travel") {
        const intentMoveTarget = getIntentMoveTarget(activeIntent);
        const intentMoveDistanceX = intentMoveTarget.x - pos.x;
        const intentMoveDistanceZ = intentMoveTarget.z - pos.z;
        const intentMoveDistance = Math.sqrt(intentMoveDistanceX * intentMoveDistanceX + intentMoveDistanceZ * intentMoveDistanceZ);
        const intentYaw = Math.atan2(intentMoveTarget.x - pos.x, -(intentMoveTarget.z - pos.z));
        targetYaw = intentYaw + Math.sin(elapsed * 0.76 + activeIntent.x * 0.001) * 0.045;
        const closeEnough = activeIntentDistance <= intentCompletionDistance(activeIntent);
        mode = closeEnough ? "act" : "approach";
        sprint = !closeEnough && activeIntentDistance > 72 && activeIntent.kind !== "quest-target" && activeIntent.kind !== "darrel-dragon";
        if (activeIntent.kind === "spell-dummy") {
          if (qaSpellDummyRunActive) {
            mode = "act";
            forwardAmount = activeIntentDistance < QA_INTENT_DUMMY_CLOSE_DISTANCE ? -0.04 : 0;
            strafeAmount = Math.sin(elapsed * 2.15 + activeIntent.x * 0.01) * 0.04;
            sprint = false;
          } else if (activeIntentDistance < QA_INTENT_DUMMY_CLOSE_DISTANCE) {
            forwardAmount = -0.18;
          } else if (activeIntentDistance > QA_INTENT_DUMMY_KEEP_DISTANCE) {
            forwardAmount = 0.42;
          } else {
            forwardAmount = 0.04;
          }
          if (!qaSpellDummyRunActive) {
            strafeAmount = Math.sin(elapsed * 2.15 + activeIntent.x * 0.01) * 0.24;
          }
        } else if (closeEnough) {
          forwardAmount = activeIntent.kind === "mana-flower" ? 0.08 : 0;
          strafeAmount = Math.sin(elapsed * 1.4 + activeIntent.z * 0.006) * 0.1;
        } else {
          forwardAmount = THREE.MathUtils.clamp(intentMoveDistance / 130, 0.34, 0.72);
          strafeAmount *= 0.35;
        }
        const intentYawError = Math.abs(angleDeltaRadians(qaWalkYaw.current ?? currentYaw, targetYaw));
        const turnBeforeAdvanceThreshold = forwardClearance < QA_SURVIVAL_WALK_SOFT_CLEARANCE
          ? QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR * 0.74
          : QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR * 1.45;
        if (!closeEnough && intentYawError > turnBeforeAdvanceThreshold) {
          forwardAmount = 0;
          strafeAmount *= 0.35;
          sprint = false;
        }
        if (
          activeIntent.kind === "darrel-dragon" &&
          activeIntentDistance < QA_DARREL_GROVE_DRAGON_STEP_JUMP_DISTANCE &&
          state.clock.elapsedTime > qaWalkJumpHeldUntil.current + 0.9 &&
          (
            velocity.x * velocity.x + velocity.z * velocity.z < QA_SURVIVAL_LOW_SPEED_THRESHOLD * QA_SURVIVAL_LOW_SPEED_THRESHOLD ||
            intentMoveDistance < 34
          )
        ) {
          qaWalkJumpHeldUntil.current = state.clock.elapsedTime + 0.18;
        }
        if (activeIntent.observeUntil && elapsed < activeIntent.observeUntil) {
          forwardAmount *= 0.34;
          sprint = false;
        }
        if (
          (activeIntent.kind === "quest-target" || activeIntent.kind === "darrel-dragon") &&
          activeIntentDistance <= intentCompletionDistance(activeIntent) &&
          elapsed - qaWalkLastInteractionAt.current > QA_INTENT_INTERACT_COOLDOWN_SECONDS
        ) {
          const detail = dispatchQuestVillagerInteraction("qa-walk");
          qaWalkLastInteractionAt.current = elapsed;
          publishSurvivalWalkAction(detail.handled
            ? `interact:${activeIntent.kind}:${activeIntent.id}`
            : `observe:${activeIntent.kind}:${activeIntent.id}`);
        }
        if (
          activeIntent.kind === "mana-flower" &&
          wasSurvivalWalkManaFlowerCollected(activeIntent.id)
        ) {
          publishSurvivalWalkAction(`collect:${activeIntent.id}`);
          qaWalkIntent.current = null;
          qaWalkNextIntentAt.current = elapsed + 0.8;
        }
      }

      const scheduleNextCombatCast = (minimumSeconds = QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL) => {
        const minInterval = qaSpellDummyRunActive
          ? Math.min(minimumSeconds, QA_SPELL_DUMMY_COMBAT_CAST_MIN_INTERVAL)
          : minimumSeconds;
        const maxInterval = qaSpellDummyRunActive
          ? QA_SPELL_DUMMY_COMBAT_CAST_MAX_INTERVAL
          : QA_SURVIVAL_COMBAT_CAST_MAX_INTERVAL;
        qaWalkNextCombatCastAt.current = elapsed + randomRangeFromNoise(
          survivalishTurnNoise(pos.x + 211, pos.z - 173, elapsed + qaWalkCombatSpellIndex.current),
          minInterval,
          maxInterval,
        );
      };

      const scheduleNextPracticeCast = (minimumSeconds = QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL) => {
        qaWalkNextPracticeCastAt.current = elapsed + randomRangeFromNoise(
          survivalishTurnNoise(pos.x - 419, pos.z + 283, elapsed + qaWalkPracticeSpellIndex.current),
          minimumSeconds,
          QA_SURVIVAL_PRACTICE_CAST_MAX_INTERVAL,
        );
      };

      const castQaPracticeSpell = (spell: SpellType) => {
        const dir = spellDirection;
        camera.getWorldDirection(dir);
        if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
        dir.normalize();

        const hand: HandType = qaWalkPracticeSpellIndex.current % 2 === 0 ? "right" : "left";
        const { spawnPos } = getPlayerSpellLaunchInto(hand, camera, dir, spellLaunchScratch);
        const flatDir = spellFlatDirection.set(dir.x, 0, dir.z);
        if (flatDir.lengthSq() < 0.001) flatDir.set(0, 0, -1);
        flatDir.normalize();
        const castAtTarget = spell === "lightning";
        const projectilePos = castAtTarget
          ? {
            x: pos.x + flatDir.x * 26,
            y: pos.y - PLAYER_FOOT_OFFSET + 0.2,
            z: pos.z + flatDir.z * 26,
          }
          : { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };
        const projectile = {
          id: createQaWalkPracticeProjectileId(spell, nowMs),
          creatorId: getLocalNetworkPlayerId(),
          type: spell,
          pos: projectilePos,
          dir: { x: dir.x, y: dir.y, z: dir.z },
          createdAt: nowMs,
          hand,
        };

        const store = useGameStore.getState();
        store.setHandCharging(hand, true);
        window.setTimeout(() => {
          useGameStore.getState().setHandCharging(hand, false);
        }, spell === "arcanebeam" ? 420 : 220);
        emitGameNetworkEvent("castSpell", projectile);
        store.addProjectile(projectile as any);
        publishSurvivalWalkPracticeCast(spell);
      };

      if (qaWalkNextCombatCastAt.current <= 0) {
        scheduleNextCombatCast(QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL * 0.55);
      }
      if (qaWalkNextPracticeCastAt.current <= 0) {
        scheduleNextPracticeCast(QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL * 0.45);
      }

      const spellDummies = getQaSpellDummies();
      let nearestSpellDummy: (typeof spellDummies)[number] | null = null;
      let nearestSpellDummyDistanceSq = Number.POSITIVE_INFINITY;
      let nearestAnySpellDummy: (typeof spellDummies)[number] | null = null;
      let nearestAnySpellDummyDistanceSq = Number.POSITIVE_INFINITY;
      let activeSpellDummyTarget: (typeof spellDummies)[number] | null = null;
      let activeSpellDummyTargetDistanceSq = Number.POSITIVE_INFINITY;
      const combatTargetRangeSq = QA_SURVIVAL_COMBAT_TARGET_RANGE * QA_SURVIVAL_COMBAT_TARGET_RANGE;
      const dummyReanchorDistanceSq = QA_DUMMY_REANCHOR_DISTANCE * QA_DUMMY_REANCHOR_DISTANCE;
      const expandedCombatTargetRangeSq = combatTargetRangeSq * 1.35 * 1.35;
      const activeSpellDummyId = activeIntent?.kind === "spell-dummy" ? activeIntent.id : null;

      for (const dummy of spellDummies) {
        const distanceX = dummy.position.x - pos.x;
        const distanceZ = dummy.position.z - pos.z;
        const distanceSq = distanceX * distanceX + distanceZ * distanceZ;
        if (distanceSq < nearestAnySpellDummyDistanceSq) {
          nearestAnySpellDummyDistanceSq = distanceSq;
          nearestAnySpellDummy = dummy;
        }
        if (distanceSq <= combatTargetRangeSq && distanceSq < nearestSpellDummyDistanceSq) {
          nearestSpellDummyDistanceSq = distanceSq;
          nearestSpellDummy = dummy;
        }
        if (activeSpellDummyId && dummy.id === activeSpellDummyId) {
          activeSpellDummyTarget = dummy;
          activeSpellDummyTargetDistanceSq = distanceSq;
        }
      }

      const combatSpellDummy = activeSpellDummyTarget && activeSpellDummyTargetDistanceSq <= expandedCombatTargetRangeSq
        ? activeSpellDummyTarget
        : nearestSpellDummy;
      const qaSpellDummyHits = getSurvivalWalkSpellDummyHitCount();
      const activeDummyTooFar = qaSpellDummyRunActive &&
        activeIntent?.kind === "spell-dummy" &&
        activeIntentDistance > QA_DUMMY_REANCHOR_DISTANCE;

      if (
        qaSpellDummyRunActive &&
        nearestAnySpellDummy &&
        (qaSpellDummyHits <= 0 || nearestAnySpellDummyDistanceSq > dummyReanchorDistanceSq || activeDummyTooFar) &&
        (
          nearestAnySpellDummyDistanceSq > dummyReanchorDistanceSq ||
          activeDummyTooFar ||
          ((mode === "recover" || mode === "avoid") && nearestAnySpellDummyDistanceSq > dummyReanchorDistanceSq)
        ) &&
        elapsed - qaWalkLastDummyReanchorAt.current > QA_DUMMY_REANCHOR_COOLDOWN_SECONDS
      ) {
        const yawForSpawn = mode === "recover" && qaWalkRecoveryYaw.current
          ? qaWalkRecoveryYaw.current
          : qaWalkYaw.current ?? currentYaw;
        const spawnForwardX = Math.sin(yawForSpawn);
        const spawnForwardZ = -Math.cos(yawForSpawn);
        const spawnOffset = mode === "recover" || mode === "avoid" ? 14 : 8;
        dispatchQaSpellDummySpawn({
          x: pos.x + spawnForwardX * spawnOffset,
          y: pos.y + 0.2,
          z: pos.z + spawnForwardZ * spawnOffset,
          yaw: yawForSpawn,
          preserveHealth: qaSpellDummyHits > 0,
        });
        qaWalkLastDummyReanchorAt.current = elapsed;
        qaWalkIntent.current = null;
        qaWalkNextIntentAt.current = 0;
        qaWalkNextCombatCastAt.current = Math.min(qaWalkNextCombatCastAt.current || Infinity, elapsed + 0.6);
        qaWalkStuckStrikes.current = 0;
        publishSurvivalWalkAction(`dummy-reanchor:${Math.round(Math.sqrt(nearestAnySpellDummyDistanceSq))}`);
      }

      if (
        combatSpellDummy &&
        (mode === "travel" || mode === "approach" || mode === "act") &&
        elapsed >= qaWalkNextCombatCastAt.current &&
        elapsed - qaWalkLastCombatCastAt.current > 1.2
      ) {
        const aimYaw = Math.atan2(combatSpellDummy.position.x - pos.x, -(combatSpellDummy.position.z - pos.z));
        const spell = QA_SURVIVAL_COMBAT_SPELL_SEQUENCE[qaWalkCombatSpellIndex.current % QA_SURVIVAL_COMBAT_SPELL_SEQUENCE.length];
        qaWalkCombatSpellIndex.current += 1;
        qaWalkLastCombatCastAt.current = elapsed;
        qaWalkCombatFocusUntil.current = elapsed + QA_SURVIVAL_COMBAT_FOCUS_SECONDS;
        qaWalkCombatTargetYaw.current = aimYaw;
        dispatchQaSpellCastAtDummy({ spell, targetId: combatSpellDummy.id });
        publishSurvivalWalkAction(`cast:${spell}:${combatSpellDummy.id}`);
        scheduleNextCombatCast();
      }

      if (qaSpellDummyRunActive && activeIntent?.kind === "spell-dummy" && rigidBody.current) {
        const currentLinvel = rigidBody.current.linvel();
        const horizontalSpeedSq = currentLinvel.x * currentLinvel.x + currentLinvel.z * currentLinvel.z;
        if (horizontalSpeedSq > 0.35 * 0.35) {
          rigidBody.current.setLinvel({ x: 0, y: currentLinvel.y, z: 0 }, true);
        }
      }

      if (
        !combatSpellDummy &&
        (!activeIntent || activeIntent.kind === "landmark") &&
        mode === "travel" &&
        elapsed >= qaWalkNextPracticeCastAt.current &&
        forwardClearance > QA_SURVIVAL_WALK_BLOCKED_CLEARANCE &&
        viewClearance > QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE
      ) {
        const spell = QA_SURVIVAL_PRACTICE_SPELL_SEQUENCE[qaWalkPracticeSpellIndex.current % QA_SURVIVAL_PRACTICE_SPELL_SEQUENCE.length];
        qaWalkPracticeSpellIndex.current += 1;
        castQaPracticeSpell(spell);
        qaWalkCombatFocusUntil.current = elapsed + QA_SURVIVAL_COMBAT_FOCUS_SECONDS * 0.72;
        qaWalkCombatTargetYaw.current = qaWalkYaw.current ?? currentYaw;
        scheduleNextPracticeCast();
      }

      if (combatSpellDummy && (mode === "travel" || mode === "approach" || mode === "act") && elapsed < qaWalkCombatFocusUntil.current) {
        mode = activeIntent?.kind === "spell-dummy" ? "act" : "inspect";
        targetYaw = qaWalkCombatTargetYaw.current + Math.sin(elapsed * 2.4) * 0.05;
        forwardAmount = qaSpellDummyRunActive ? 0 : 0.06;
        strafeAmount = Math.sin(elapsed * 3.1) * (qaSpellDummyRunActive ? 0.035 : 0.1);
        sprint = false;
      } else if (mode === "route") {
        if (
          forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE ||
          viewClearance < QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE ||
          overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE
        ) {
          forwardAmount = Math.min(forwardAmount, 0.22);
          sprint = false;
        } else if (
          forwardClearance < QA_SURVIVAL_WALK_SOFT_CLEARANCE ||
          forwardLookAhead < QA_SURVIVAL_WALK_SOFT_LOOKAHEAD
        ) {
          forwardAmount = Math.min(forwardAmount, 0.72);
          sprint = false;
        }
      } else if (mode === "travel") {
        const clearanceEase = THREE.MathUtils.clamp(
          (forwardClearance - QA_SURVIVAL_WALK_BLOCKED_CLEARANCE) / Math.max(1, QA_SURVIVAL_WALK_SOFT_CLEARANCE - QA_SURVIVAL_WALK_BLOCKED_CLEARANCE),
          0.32,
          1,
        );
        const lookAheadEase = THREE.MathUtils.clamp(
          (forwardLookAhead - QA_SURVIVAL_WALK_SOFT_LOOKAHEAD) / Math.max(1, QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE - QA_SURVIVAL_WALK_SOFT_LOOKAHEAD),
          0.38,
          1,
        );
        const humanThrottle = Math.min(clearanceEase, lookAheadEase);
        forwardAmount *= humanThrottle;
        if (humanThrottle < 0.72) sprint = false;
      }

      const planarSpeedSq = velocity.x * velocity.x + velocity.z * velocity.z;
      const planarSpeed = Math.sqrt(planarSpeedSq);
      const expectingMovement = mode !== "inspect" && forwardAmount > 0.18;
      if (!lilyCoilTubeQaActive && expectingMovement && planarSpeedSq < QA_SURVIVAL_LOW_SPEED_THRESHOLD * QA_SURVIVAL_LOW_SPEED_THRESHOLD) {
        if (qaWalkLowSpeedStartedAt.current <= 0) {
          qaWalkLowSpeedStartedAt.current = elapsed;
        } else if (elapsed - qaWalkLowSpeedStartedAt.current > QA_SURVIVAL_LOW_SPEED_TRIGGER_SECONDS) {
          qaWalkStuckStrikes.current = Math.min(qaWalkStuckStrikes.current + 1, 6);
          mode = "recover";
          recoveryReason = "low-speed";
          beginQaWalkRecovery(true);
          targetYaw = qaWalkRecoveryYaw.current;
          strafeAmount = 0;
          forwardAmount = -0.24;
          sprint = false;
          qaWalkLowSpeedStartedAt.current = elapsed;
        }
      } else {
        qaWalkLowSpeedStartedAt.current = 0;
      }

      if (!lilyCoilTubeQaActive && mode !== "inspect" && mode !== "act" && elapsed - qaWalkLastProgressAt.current > QA_SURVIVAL_STUCK_CHECK_SECONDS) {
        const progressDistanceX = pos.x - qaWalkLastProgressPos.current.x;
        const progressDistanceZ = pos.z - qaWalkLastProgressPos.current.z;
        const progressDistanceSq = progressDistanceX * progressDistanceX + progressDistanceZ * progressDistanceZ;
        const previousWaypointDistanceX = qaWalkWaypoint.current.x - qaWalkLastProgressPos.current.x;
        const previousWaypointDistanceZ = qaWalkWaypoint.current.z - qaWalkLastProgressPos.current.z;
        const previousWaypointDistance = Math.sqrt(
          previousWaypointDistanceX * previousWaypointDistanceX +
          previousWaypointDistanceZ * previousWaypointDistanceZ,
        );
        const towardProgress = previousWaypointDistance - waypointDistance;
        const clearLane = forwardClearance > QA_SURVIVAL_WALK_PROBE_DISTANCE * 0.88;
        const movingClearly = planarSpeedSq > (QA_SURVIVAL_LOW_SPEED_THRESHOLD * 1.35) * (QA_SURVIVAL_LOW_SPEED_THRESHOLD * 1.35);
        if (
          progressDistanceSq < QA_SURVIVAL_WALK_MIN_PROGRESS * QA_SURVIVAL_WALK_MIN_PROGRESS ||
          (!clearLane && towardProgress < QA_SURVIVAL_WALK_MIN_TOWARD_PROGRESS)
        ) {
          qaWalkStuckStrikes.current = Math.min(qaWalkStuckStrikes.current + 1, 6);
          mode = "recover";
          recoveryReason = progressDistanceSq < QA_SURVIVAL_WALK_MIN_PROGRESS * QA_SURVIVAL_WALK_MIN_PROGRESS ? "progress" : "blocked-progress";
          beginQaWalkRecovery(true);
          targetYaw = qaWalkRecoveryYaw.current;
          strafeAmount = 0;
          forwardAmount = qaWalkStuckStrikes.current > 1 ? -0.24 : 0;
          sprint = false;
        } else if (!qaRouteActive && clearLane && movingClearly && towardProgress < -QA_SURVIVAL_WALK_MIN_TOWARD_PROGRESS) {
          setForwardQaWaypoint(qaWalkYaw.current ?? currentYaw);
        } else if (progressDistanceSq > (QA_SURVIVAL_WALK_MIN_PROGRESS * 1.55) * (QA_SURVIVAL_WALK_MIN_PROGRESS * 1.55)) {
          qaWalkStuckStrikes.current = 0;
        }
        qaWalkLastProgressAt.current = elapsed;
        qaWalkLastProgressPos.current.set(pos.x, pos.y, pos.z);
      }

      const turnRate = mode === "recover"
        ? QA_SURVIVAL_RECOVERY_TURN_RATE
        : mode === "inspect"
          ? QA_SURVIVAL_LOOK_TURN_RATE * 0.72
          : QA_SURVIVAL_LOOK_TURN_RATE;
      const yaw = moveAngleTowardsRadians(qaWalkYaw.current, targetYaw, turnRate * delta);
      qaWalkYaw.current = yaw;
      const pitch = mode === "inspect"
        ? -0.02 + Math.sin(elapsed * 1.18) * 0.1
        : -0.045 + Math.sin(elapsed * 0.62) * 0.032;
      const cameraYaw = lilyCoilTubeQaActive ? yaw : -yaw;
      controllerLookEuler.current.set(pitch, cameraYaw, 0);
      camera.quaternion.setFromEuler(controllerLookEuler.current);

      const inputMode: QaSurvivalWalkMode = lilyCoilTubeQaActive ? "tube" : mode;
      qaWalkInputState.current = {
        forward: THREE.MathUtils.clamp(forwardAmount, inputMode === "tube" ? -1 : -0.28, 1),
        strafe: THREE.MathUtils.clamp(strafeAmount, -0.72, 0.72),
        sprint,
        mode: inputMode,
      };
      const movingInOpenLane = !lilyCoilTubeQaActive &&
        planarSpeedSq > (QA_SURVIVAL_LOW_SPEED_THRESHOLD * 2.2) * (QA_SURVIVAL_LOW_SPEED_THRESHOLD * 2.2) &&
        forwardClearance > QA_SURVIVAL_WALK_SOFT_CLEARANCE &&
        forwardLookAhead > QA_SURVIVAL_WALK_SOFT_LOOKAHEAD &&
        viewClearance > QA_SURVIVAL_VIEW_SOFT_CLEARANCE * 0.82;
      if (movingInOpenLane && qaWalkStuckStrikes.current > 0) {
        qaWalkStuckStrikes.current = Math.max(0, qaWalkStuckStrikes.current - 2);
        if (mode === "recover") {
          qaWalkRecoveryUntil.current = Math.min(qaWalkRecoveryUntil.current, elapsed + 0.18);
        }
      }
      const telemetryDt = qaWalkLastTelemetryAt.current > 0 ? elapsed - qaWalkLastTelemetryAt.current : 0;
      const telemetryMoveX = pos.x - qaWalkLastTelemetryPos.current.x;
      const telemetryMoveY = pos.y - qaWalkLastTelemetryPos.current.y;
      const telemetryMoveZ = pos.z - qaWalkLastTelemetryPos.current.z;
      const telemetryMoveSq = telemetryDt > 0
        ? telemetryMoveX * telemetryMoveX + telemetryMoveY * telemetryMoveY + telemetryMoveZ * telemetryMoveZ
        : 0;
      const telemetryJumpThreshold = Math.max(36, planarSpeed * Math.max(telemetryDt, 0.016) * 3 + 18);
      const positionJumpAbnormality = telemetryDt > 0 &&
        telemetryMoveSq > telemetryJumpThreshold * telemetryJumpThreshold;
      qaWalkLastTelemetryAt.current = elapsed;
      qaWalkLastTelemetryPos.current.set(pos.x, pos.y, pos.z);
      const activeRouteWaypoint = qaRouteActive
        ? qaRouteWaypoints[qaWalkRouteIndex.current % qaRouteWaypoints.length]
        : null;
      const recoveryAbnormality = recoveryReason && !["clear-exit", "progress"].includes(recoveryReason) && qaWalkStuckStrikes.current >= 2
        ? `recovery:${recoveryReason}`
        : "";
      const abnormality = recoveryAbnormality
        ? recoveryAbnormality
        : positionJumpAbnormality
          ? `position-jump:${Math.round(Math.sqrt(telemetryMoveSq))}`
          : qaWalkStuckStrikes.current >= 3 && !movingInOpenLane
          ? "stuck-strikes"
            : overheadClearance < QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE
              ? "low-overhead"
              : !lilyCoilTubeQaActive && expectingMovement && planarSpeedSq < (QA_SURVIVAL_LOW_SPEED_THRESHOLD * 0.65) * (QA_SURVIVAL_LOW_SPEED_THRESHOLD * 0.65)
                ? "slow-input"
                : forwardClearance < QA_SURVIVAL_WALK_BLOCKED_CLEARANCE
                  ? "low-clearance"
                  : viewClearance < QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE
                    ? "low-view"
                    : "";
      publishSurvivalWalkFrameTelemetry({
        mode: inputMode,
        input: qaWalkInputState.current,
        sprint,
        forwardClearance,
        viewClearance,
        overheadClearance,
        planarSpeed,
        yaw,
        targetYaw,
        stuckStrikes: qaWalkStuckStrikes.current,
        waypoint: qaWalkWaypoint.current,
        position: pos,
        chunkCenterX,
        chunkCenterZ,
        recoveryReason,
        combatActive: elapsed < qaWalkCombatFocusUntil.current,
        activeIntent,
        activeIntentDistance,
        activeRouteWaypoint,
        routeIndex: qaWalkRouteIndex.current,
        routeLength: qaRouteWaypoints.length,
        waypointDistance,
        observed: {
          mana: getReadyQaManaFlowers().length,
          dummies: spellDummies.length,
          quests: getQuestNavigationIntentTargets().length,
        },
        abnormality,
        lilyTube: lilyCoilTubeTravelState
          ? { t: lilyCoilTubeTravelState.t, direction: qaWalkLilyTubeDirection.current }
          : null,
      });
    } else if (!qaWalkActive) {
      resetQaWalkSession();
      clearSurvivalWalkRouteTelemetry();
    }

    if (storeState.isSpellMenuOpen || storeState.questDialogSession || storeState.isInventoryOpen) {
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;
      rigidBody.current.setLinvel({ x: 0, y: vclipActive ? 0 : velocity.y, z: 0 }, true);
      dispatchPlayerStateIfChanged(lastDispatchedPlayerStateRef.current, false, false, false, false, true, false);
      return;
    }

    const chargingHands = storeState.chargingHands;

    for (let handIndex = 0; handIndex < PLAYER_CASTING_HANDS.length; handIndex += 1) {
      const hand = PLAYER_CASTING_HANDS[handIndex];
      const handSpell = getPlayerSpellForHand(storeState, hand);
      const runeReady = hasPlayerRunePowerForHand(storeState, hand);

      if (!storeState.isMagicArmed) {
        if (chargingHands[hand] || activeCastingHands.current[hand]) {
          clearPlayerCastingHandState(activeCastingHands, hand, useGameStore.getState().setHandCharging);
        }
        flamethrowerTimers.current[hand] = 0;
        continue;
      }

      if (!runeReady) {
        if (chargingHands[hand]) {
          clearPlayerCastingHandState(activeCastingHands, hand, useGameStore.getState().setHandCharging);
        }
        flamethrowerTimers.current[hand] = 0;
        continue;
      }

      if (handSpell === 'healspell' && chargingHands[hand]) {
        clearToxicEffectsWithNetwork();
        health = Math.min(100, health + (2 * delta));
        useGameStore.getState().setHealth(health);
      }

      if (handSpell === 'flamethrower' && chargingHands[hand] && gameplayInputActive) {
        flamethrowerTimers.current[hand] += delta;
        if (flamethrowerTimers.current[hand] <= 0.05) continue;

        flamethrowerTimers.current[hand] = 0;
        const dir = spellDirection;
        camera.getWorldDirection(dir);
        const lateral = spellLateral.crossVectors(camera.up, dir).normalize();
        
        applyFlamethrowerSpreadInto(dir);

        const { spawnPos } = getPlayerSpellLaunchInto(hand, camera, dir, spellLaunchScratch, true, lateral);

        const projectile = {
          id: createPlayerSpellProjectileId(),
          creatorId: getLocalNetworkPlayerId(),
          type: 'flamethrower',
          pos: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
          dir: { x: dir.x, y: dir.y, z: dir.z },
          createdAt: nowMs,
          hand
        };
        
        emitGameNetworkEvent("castSpell", projectile);
        useGameStore.getState().addProjectile(projectile as any);
      }
    }

    // Calculate robust yaw angle
    camera.getWorldDirection(frameForward);
    const yaw = Math.atan2(frameForward.x, -frameForward.z);
    publishLastPlayerYaw(yaw);

    if (sleepActive) {
      if (isSliding) setIsSliding(false);
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;
      for (let handIndex = 0; handIndex < PLAYER_CASTING_HANDS.length; handIndex += 1) {
        const hand = PLAYER_CASTING_HANDS[handIndex];
        if (activeCastingHands.current[hand] || storeState.chargingHands[hand]) {
          clearPlayerCastingHandState(activeCastingHands, hand, useGameStore.getState().setHandCharging);
        }
        flamethrowerTimers.current[hand] = 0;
      }
    }

    // Movement calculation
    readPlayerControllerGamepadMovementInput({
      gamepad,
      controllerInputActive,
      controllerBindings: storeState.controllerBindings,
      refs: controllerGamepadMovementRefs,
      target: controllerGamepadMovementInput,
    });
    const qaJumpHeld = qaWalkActive && state.clock.elapsedTime < qaWalkJumpHeldUntil.current;
    const {
      qaWalkSprintHeld,
      jumpHeld,
      jumpRequested,
      descendHeld,
      crouchInputHeld,
      verticalInput,
      forwardInput,
      strafeInput,
      ladderActive,
      ladderVerticalInput,
      hasPlanarMovementInput,
      hasMovementInput,
    } = resolvePlayerMovementInputIntent({
      keys,
      controllerMovementInput: controllerGamepadMovementInput,
      touchControlsActive: storeState.isTouchControlsActive,
      touchMove: touchMove.current,
      touchButtons: touchButtons.current,
      keyboardJumpWasPressed,
      touchJumpWasPressed,
      touchSprintWasPressed,
      controllerSprintLatched,
      touchSprintLatched,
      qaWalkActive,
      qaWalkInput: qaWalkInputState.current,
      qaJumpHeld,
      qaJumpWasPressed: qaWalkJumpWasPressed,
      activeLadderZoneCount: activeLadderZones.current.size,
      vclipActive,
      sleepActive,
      frontVector,
      sideVector,
      direction,
    });

    const {
      jumpBoostActive,
      isSprinting,
      slideInputHeld,
      slideHeld,
      slideSpeed,
      currentSpeed,
    } = resolvePlayerMovementMotionState({
      nowMs,
      speedBoostUntil: storeState.speedBoostUntil,
      jumpBoostUntil: storeState.jumpBoostUntil,
      slowActive,
      sleepActive,
      vclipActive,
      descendHeld,
      hasMovementInput,
      hasPlanarMovementInput,
      keyboardSprintHeld: keys.ShiftLeft,
      controllerSprintLatched: controllerSprintLatched.current,
      touchSprintLatched: touchSprintLatched.current,
      qaWalkSprintHeld,
      isSliding,
      isCrouching,
    });

    qaPosition.set(pos.x, pos.y, pos.z);
    const lilyCoilTubeActive =
      !vclipActive &&
      !sleepActive &&
      !astralActive &&
      !grabbedState.current &&
      isInLilyCoilTubeChunk(qaPosition, storeState.gameMode);

    if (lilyCoilTubeActive) {
      const tubeState = lilyCoilTubeState.current;
      const shouldAlignTubeView = !tubeState.active;
      if (shouldAlignTubeView) {
        const nearest = getNearestLilyCoilTubeState(qaPosition, lilyCoilNearestScratch);
        tubeState.t = nearest.t;
        tubeState.surfaceAngle = nearest.surfaceAngle;
        tubeState.jumpOffset = 0;
        tubeState.jumpVelocity = 0;
        tubeState.active = true;
      }

      let tubeSliding = isSliding;
      const tubeSlideHeld = slideInputHeld && hasPlanarMovementInput;
      const tubeGroundedBeforeMove = tubeState.jumpOffset <= 0.025 && tubeState.jumpVelocity <= 0;
      if (tubeGroundedBeforeMove && tubeSlideHeld && !tubeSliding) {
        if (nowMs - lastSlideTime.current >= SLIDE_RESTART_COOLDOWN_MS) {
          tubeSliding = true;
          setIsSliding(true);
          slideTimer.current = 1.0;
          lastSlideTime.current = nowMs;
        }
      }
      if (tubeSliding) {
        slideTimer.current -= delta;
        if (slideTimer.current <= 0 || !tubeSlideHeld) {
          tubeSliding = false;
          setIsSliding(false);
        }
      }

      const tubeMoveSpeed = (tubeSliding ? slideSpeed : currentSpeed) * 4.8;
      const tubeStrafeInput = strafeInput;
      const qaTubeAutoPilot = qaWalkActive && qaWalkInputState.current.mode === "tube";
      const currentFrame = getLilyCoilTubeFrameInto(tubeState.t, lilyCoilCurrentFrame);
      const currentRadial = tubeCurrentRadial
        .copy(currentFrame.up)
        .multiplyScalar(Math.cos(tubeState.surfaceAngle))
        .addScaledVector(currentFrame.side, Math.sin(tubeState.surfaceAngle))
        .normalize();
      const currentPlayerUp = tubeCurrentPlayerUp.copy(currentRadial).multiplyScalar(-1);
      const currentAroundSurface = tubeCurrentAroundSurface
        .copy(currentFrame.up)
        .multiplyScalar(-Math.sin(tubeState.surfaceAngle))
        .addScaledVector(currentFrame.side, Math.cos(tubeState.surfaceAngle))
        .normalize();
      const cameraForward = tubeCameraForward;
      camera.getWorldDirection(cameraForward);
      const cameraRight = tubeCameraRight.crossVectors(cameraForward, currentPlayerUp);
      if (cameraRight.lengthSq() < 0.0001) cameraRight.copy(currentAroundSurface);
      cameraRight.normalize();
      const surfaceForward = tubeSurfaceForward
        .copy(cameraForward)
        .addScaledVector(currentPlayerUp, -cameraForward.dot(currentPlayerUp));
      if (surfaceForward.lengthSq() < 0.0001) surfaceForward.copy(currentFrame.tangent);
      surfaceForward.normalize();
      const surfaceRight = tubeSurfaceRight
        .copy(cameraRight)
        .addScaledVector(currentPlayerUp, -cameraRight.dot(currentPlayerUp));
      if (surfaceRight.lengthSq() < 0.0001) surfaceRight.copy(currentAroundSurface);
      surfaceRight.normalize();
      let tubePathInput: number;
      let tubeSurfaceInput: number;
      if (qaTubeAutoPilot) {
        tubePathInput = THREE.MathUtils.clamp(qaWalkInputState.current.forward, -1, 1);
        tubeSurfaceInput = THREE.MathUtils.clamp(qaWalkInputState.current.strafe, -0.72, 0.72);
      } else {
        tubeMoveDirection
          .copy(surfaceForward)
          .multiplyScalar(forwardInput)
          .addScaledVector(surfaceRight, tubeStrafeInput);
        if (tubeMoveDirection.lengthSq() > 1) tubeMoveDirection.normalize();
        tubePathInput = THREE.MathUtils.clamp(tubeMoveDirection.dot(currentFrame.tangent), -1, 1);
        tubeSurfaceInput = THREE.MathUtils.clamp(tubeMoveDirection.dot(currentAroundSurface), -1, 1);
      }

      tubeState.t = THREE.MathUtils.clamp(
        tubeState.t + (tubePathInput * tubeMoveSpeed * delta) / LILY_COIL_TUBE_PATH_LENGTH,
        0,
        1,
      );
      tubeState.surfaceAngle += tubeSurfaceInput * (tubeMoveSpeed / Math.max(8, LILY_COIL_TUBE_PLAYER_RADIUS)) * delta;
      tubeState.surfaceAngle = normalizeAngleRadians(tubeState.surfaceAngle);

      const frame = getLilyCoilTubeFrameInto(tubeState.t, lilyCoilNextFrame);
      const radial = tubeRadial
        .copy(frame.up)
        .multiplyScalar(Math.cos(tubeState.surfaceAngle))
        .addScaledVector(frame.side, Math.sin(tubeState.surfaceAngle))
        .normalize();
      const playerUp = tubePlayerUp.copy(radial).multiplyScalar(-1);
      const aroundSurface = tubeAroundSurface
        .copy(frame.up)
        .multiplyScalar(-Math.sin(tubeState.surfaceAngle))
        .addScaledVector(frame.side, Math.cos(tubeState.surfaceAngle))
        .normalize();
      const tubeGrounded = tubeState.jumpOffset <= 0.025 && tubeState.jumpVelocity <= 0;
      const fuel = useGameStore.getState().thrusterFuel;
      let newFuel = fuel;
      if (!jumpHeld) {
        thrusterLocked.current = false;
      }
      if (jumpRequested && tubeGrounded) {
        tubeState.jumpVelocity = LILY_COIL_TUBE_JUMP_FORCE * (jumpBoostActive ? JUMP_BOOST_MULTIPLIER : 1);
        setJumps(1);
        thrusterLocked.current = false;
      } else if (jumpHeld && !tubeGrounded && newFuel > 0 && !thrusterLocked.current) {
        tubeState.jumpVelocity += 35 * (jumpBoostActive ? JUMP_BOOST_MULTIPLIER : 1) * delta;
        newFuel = Math.max(0, newFuel - delta * 0.8);
        if (newFuel === 0) {
          thrusterLocked.current = true;
        }
      }
      if (tubeState.jumpOffset > 0 || tubeState.jumpVelocity > 0) {
        tubeState.jumpVelocity -= LILY_COIL_TUBE_JUMP_GRAVITY * delta;
        tubeState.jumpOffset = THREE.MathUtils.clamp(
          tubeState.jumpOffset + tubeState.jumpVelocity * delta,
          0,
          LILY_COIL_TUBE_MAX_JUMP_OFFSET,
        );
        if (tubeState.jumpOffset <= 0) {
          tubeState.jumpOffset = 0;
          tubeState.jumpVelocity = 0;
        }
      }
      if (tubeGrounded && newFuel < 1.0) {
        newFuel = Math.min(1.0, newFuel + delta * 0.4);
      }
      if (newFuel !== fuel) {
        useGameStore.getState().setThrusterFuel(newFuel);
      }
      const tubeAirborne = tubeState.jumpOffset > 0.025;
      tubeBodyPosition
        .copy(frame.center)
        .addScaledVector(radial, LILY_COIL_TUBE_PLAYER_RADIUS)
        .addScaledVector(playerUp, tubeState.jumpOffset);
      const tubeCameraHeight = getPlayerCameraHeight(tubeSliding, isCrouching);
      tubeCameraPosition.copy(tubeBodyPosition).addScaledVector(playerUp, tubeCameraHeight);
      tubeForward.copy(frame.tangent).multiplyScalar(forwardInput < -0.1 ? -1 : 1).normalize();

      rigidBody.current.setTranslation({ x: tubeBodyPosition.x, y: tubeBodyPosition.y, z: tubeBodyPosition.z }, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      if (qaTubeAutoPilot) {
        const qaTubeLook = tubeLookDirection
          .copy(frame.tangent)
          .multiplyScalar(tubePathInput >= -0.05 ? 1 : -1)
          .addScaledVector(aroundSurface, tubeSurfaceInput * 0.18)
          .addScaledVector(playerUp, -0.035 + Math.sin(state.clock.elapsedTime * 0.73) * 0.035);
        if (qaTubeLook.lengthSq() < 0.001) qaTubeLook.copy(frame.tangent);
        qaTubeLook.normalize();
        tubeState.lastUp.copy(playerUp);
        camera.up.copy(playerUp);
        camera.position.copy(tubeCameraPosition);
        camera.lookAt(qaTubeLook.add(tubeCameraPosition));
        controllerLookEuler.current.setFromQuaternion(camera.quaternion);
      } else {
        if (!shouldAlignTubeView) {
          tubeUpRotation.setFromUnitVectors(tubeState.lastUp, playerUp);
          camera.quaternion.premultiply(tubeUpRotation);
          controllerLookEuler.current.setFromQuaternion(camera.quaternion);
        }
        tubeState.lastUp.copy(playerUp);
        camera.up.copy(playerUp);
        camera.position.copy(tubeCameraPosition);
      }
      if (shouldAlignTubeView && !qaTubeAutoPilot) {
        camera.lookAt(tubeLookDirection.copy(tubeCameraPosition).add(tubeForward));
        controllerLookEuler.current.setFromQuaternion(camera.quaternion);
      }
      if (!tubeAirborne) setJumps(0);
      if (isCrouching) setIsCrouching(false);
      crouchHoldStartedAt.current = null;

      camera.getWorldDirection(frameForward);
      const tubeYaw = Math.atan2(frameForward.x, -frameForward.z);
      publishLastPlayerYaw(tubeYaw);
      publishLocalPlayerPosition(tubeBodyPosition, { rememberLast: true });
      (window as any).__wofLilyCoilTubeState = {
        t: tubeState.t,
        surfaceAngle: tubeState.surfaceAngle,
      };

      const tubeMoving = hasMovementInput || Math.abs(tubeSurfaceInput) > 0.05 || Math.abs(forwardInput) > 0.05;
      dispatchPlayerStateIfChanged(
        lastDispatchedPlayerStateRef.current,
        tubeMoving,
        isSprinting && !tubeSliding,
        tubeSliding,
        false,
        !tubeAirborne,
        false,
      );
      dispatchPlayerMoved({
        x: tubeBodyPosition.x,
        y: tubeBodyPosition.y,
        z: tubeBodyPosition.z,
        angle: tubeYaw,
        isMoving: tubeMoving,
        grounded: !tubeAirborne,
      });
      if (isNavigationRecordingActive()) {
        recordNavigationSample({
          gameMode: storeState.gameMode,
          pos: [tubeBodyPosition.x, tubeBodyPosition.y, tubeBodyPosition.z],
          rot: [camera.rotation.x, tubeYaw, camera.rotation.z],
          aimDir: [frameForward.x, frameForward.y, frameForward.z],
          velocity: [
            frame.tangent.x * tubePathInput * tubeMoveSpeed + aroundSurface.x * tubeSurfaceInput * tubeMoveSpeed,
            frame.tangent.y * tubePathInput * tubeMoveSpeed + aroundSurface.y * tubeSurfaceInput * tubeMoveSpeed + playerUp.y * tubeState.jumpVelocity,
            frame.tangent.z * tubePathInput * tubeMoveSpeed + aroundSurface.z * tubeSurfaceInput * tubeMoveSpeed,
          ],
          input: {
            forward: forwardInput,
            strafe: tubeStrafeInput,
            sprint: isSprinting,
            jump: jumpHeld,
            slide: tubeSlideHeld,
            vclip: false,
          },
          state: {
            grounded: !tubeAirborne,
            moving: tubeMoving,
            sliding: tubeSliding,
            sprinting: isSprinting && !tubeSliding,
            spellMenuOpen: storeState.isSpellMenuOpen,
          },
        }, nowMs);
      }

      if (nowMs - lastNetworkSync.current > 1000 / 15) {
        lastNetworkSync.current = nowMs;
        emitPlayerNetworkPoseSync({
          anim: tubeAirborne ? "jump" : tubeSliding ? "slide" : tubeMoving ? isSprinting ? "sprint" : "walk" : "holding",
          camera,
          characterCustomization: storeState.characterCustomization,
          isVoiceSpeaking: storeState.isVoiceSpeaking,
          pos: { x: tubeBodyPosition.x, y: tubeBodyPosition.y, z: tubeBodyPosition.z },
          survivalLevel: storeState.survivalLevel,
          yaw: tubeYaw,
          aimDir: frameForward,
        });
      }
      return;
    }

    const staleLilyCoilRoll = hasCameraRollAgainstWorldUp();
    if (lilyCoilTubeState.current.active || staleLilyCoilRoll) {
      resetLilyCoilCameraState();
    }

    if (hasPlanarMovementInput) {
      if (direction.lengthSq() > 1) {
        direction.normalize();
      }
      direction.multiplyScalar(currentSpeed).applyEuler(camera.rotation);
    } else {
      direction.set(0, 0, 0);
    }

    if (vclipActive) {
      if (isSliding) setIsSliding(false);
      direction.y += verticalInput * VCLIP_VERTICAL_SPEED * (isSprinting ? VCLIP_SPRINT_MULTIPLIER : 1);
    }

    if (ladderActive && ladderVerticalInput !== 0) {
      direction.x *= 0.22;
      direction.z *= 0.22;
    }
    
    const hasActiveExternalPull = pullFrames.current > 0;
    if (hasActiveExternalPull) {
      direction.x += pullVelocity.current.x;
      direction.z += pullVelocity.current.z;
      velocity.y = pullVelocity.current.y;
      pullFrames.current--;
    }
    
    const nearestGroundToi = vclipActive
      ? Number.POSITIVE_INFINITY
      : samplePlayerGroundToi({ pos, world, rapier, queryOptions: playerQueryOptions });
    const hasGroundHit = hasPlayerGroundHit(nearestGroundToi);
    const {
      lastGroundedAt: nextLastGroundedAt,
      grounded,
      climbingLadder,
      effectiveGrounded,
      idleGroundedPlanarLock,
      crouchAllowed,
    } = resolvePlayerGroundMotionState({
      nowMs,
      lastGroundedAt: lastGroundedAt.current,
      hasGroundHit,
      velocityY: velocity.y,
      vclipActive,
      ladderActive,
      hasGrabbedState: Boolean(grabbedState.current),
      hasMovementInput,
      slideHeld,
      isSliding,
      hasActiveExternalPull,
      crouchInputHeld,
      jumpHeld,
      isSprinting,
    });
    lastGroundedAt.current = nextLastGroundedAt;

    if (crouchAllowed) {
      if (crouchHoldStartedAt.current === null) {
        crouchHoldStartedAt.current = nowMs;
      } else if (!isCrouching && nowMs - crouchHoldStartedAt.current >= CROUCH_HOLD_MS) {
        setIsCrouching(true);
      }
    } else {
      crouchHoldStartedAt.current = null;
      if (isCrouching) setIsCrouching(false);
    }

    const survivalDeepRecoveryNeeded = survivalModeActive && pos.y < FLOOR_DEEP_RECOVERY_TRIGGER_Y;
    const survivalSurfaceRecoveryNeeded = survivalModeActive && !hasGroundHit;
    if (!vclipActive && !climbingLadder && !hasGroundHit && (velocity.y < -0.35 || survivalDeepRecoveryNeeded || survivalSurfaceRecoveryNeeded) && !jumpHeld && !grabbedState.current) {
      const recoveryTarget = getPlayerFloorRecoveryTarget({
        pos,
        world,
        rapier,
        queryOptions: playerQueryOptions,
        includeDeepRecovery: survivalDeepRecoveryNeeded,
      });
      if (recoveryTarget) {
        applyPlayerFloorRecovery({
          body: rigidBody.current,
          cameraHeight: getPlayerCameraHeight(isSliding, isCrouching),
          cameraPosition: camera.position,
          correctedY: recoveryTarget.correctedY,
          dispatchPlayerMoved,
          dispatchPlayerState,
          hasMovementInput,
          idleGroundedPlanarLock,
          isCrouching,
          isSliding,
          isSprinting,
          publishLocalPlayerPosition,
          resetJumps: () => setJumps(0),
          setSliding: setIsSliding,
          pos,
          velocity,
          yaw,
        });
        return;
      }
    }
    
    dispatchPlayerStateIfChanged(
      lastDispatchedPlayerStateRef.current,
      hasMovementInput,
      isSprinting,
      isSliding,
      isCrouching,
      effectiveGrounded,
      false,
    );
    dispatchPlayerMoved({ x: pos.x, y: pos.y, z: pos.z, angle: yaw, isMoving: hasMovementInput, grounded: effectiveGrounded });

    if (isNavigationRecordingActive()) {
      camera.getWorldDirection(navigationAimDirection);
      recordNavigationSample({
        gameMode: storeState.gameMode,
        pos: [pos.x, pos.y, pos.z],
        rot: [camera.rotation.x, yaw, camera.rotation.z],
        aimDir: [navigationAimDirection.x, navigationAimDirection.y, navigationAimDirection.z],
        velocity: [direction.x, vclipActive ? direction.y : velocity.y, direction.z],
        input: {
          forward: forwardInput,
          strafe: strafeInput,
          sprint: isSprinting,
          jump: jumpHeld,
          slide: slideHeld,
          vclip: vclipActive,
        },
        state: {
          grounded: effectiveGrounded,
          moving: hasMovementInput,
          sliding: isSliding,
          sprinting: isSprinting,
          spellMenuOpen: storeState.isSpellMenuOpen,
        },
      }, nowMs);
    }

    if (!vclipActive && effectiveGrounded) {
      setJumps(0);
      const planarVelocitySq = velocity.x * velocity.x + velocity.z * velocity.z;
      if (slideHeld && !isSliding && (hasPlanarMovementInput || planarVelocitySq > SLIDE_START_MIN_SPEED_SQ)) {
        if (nowMs - lastSlideTime.current >= SLIDE_RESTART_COOLDOWN_MS) {
          setIsSliding(true);
          slideTimer.current = 1.0; // slide for up to 1s
          lastSlideTime.current = nowMs;
        }
      }
    }

    if (!vclipActive && isSliding) {
      slideTimer.current -= delta;
      if (slideTimer.current <= 0 || !slideHeld) {
        setIsSliding(false);
      }
    }

    // Applying x/z movement
    const ladderVelocityY = ladderVerticalInput === 0 ? LADDER_IDLE_HOLD_SPEED : ladderVerticalInput * LADDER_CLIMB_SPEED;
    const outputVelocityX = idleGroundedPlanarLock ? 0 : direction.x;
    const outputVelocityZ = idleGroundedPlanarLock ? 0 : direction.z;
    rigidBody.current.setLinvel({
      x: outputVelocityX,
      y: vclipActive ? direction.y : climbingLadder ? ladderVelocityY : velocity.y,
      z: outputVelocityZ
    }, true);

    const fuel = useGameStore.getState().thrusterFuel;
    let newFuel = fuel;

    if (!jumpHeld) {
      thrusterLocked.current = false;
    }

    // Jump & Thruster logic
    if (!vclipActive && !sleepActive && !climbingLadder && jumpHeld) {
      if (grounded && velocity.y <= GROUND_JUMP_MAX_UPWARD_VELOCITY) {
        if (jumpRequested) {
          rigidBody.current.setLinvel({
            x: idleGroundedPlanarLock ? 0 : velocity.x,
            y: JUMP_FORCE * (jumpBoostActive ? JUMP_BOOST_MULTIPLIER : 1),
            z: idleGroundedPlanarLock ? 0 : velocity.z,
          }, true);
          setJumps(1);
          thrusterLocked.current = false; // reset lock
        }
      } else if (!grounded && fuel > 0 && !thrusterLocked.current) {
        // Continuous thrust!
        rigidBody.current.applyImpulse({ x: 0, y: 35 * (jumpBoostActive ? JUMP_BOOST_MULTIPLIER : 1) * delta, z: 0 }, true);
        newFuel = Math.max(0, fuel - delta * 0.8); // 1.25 seconds of continuous thrust
        if (newFuel === 0) {
          thrusterLocked.current = true;
        }
      }
    }

    if (!vclipActive && effectiveGrounded) {
      if (newFuel < 1.0) {
        newFuel = Math.min(1.0, newFuel + delta * 0.4); // 2.5 seconds to recharge fully
      }
    }

    if (newFuel !== fuel) {
      useGameStore.getState().setThrusterFuel(newFuel);
    }

    // Update Camera position (attached to body)
    // Adjust y for crouch
    const cameraHeight = getPlayerCameraHeight(isSliding, isCrouching);
    const targetY = pos.y + cameraHeight;
    const cameraClearancePosition = (!vclipActive && !climbingLadder)
      ? applyPlayerCameraAntiClip({
        body: rigidBody.current,
        bodyPos: pos,
        cameraHeight,
        clearPlanarVelocity: idleGroundedPlanarLock,
        eyeY: targetY,
        queryOptions: playerQueryOptions,
        rapier,
        scratch: cameraAntiClipScratch,
        survivalModeActive,
        velocity,
        world,
      })
      : null;
    const cameraBasePosition = cameraClearancePosition ?? pos;
    const resolvedTargetY = cameraClearancePosition?.eyeY ?? targetY;
    camera.position.lerp(cameraTargetPosition.current.set(cameraBasePosition.x, resolvedTargetY, cameraBasePosition.z), 0.2);
    applyScreenShake();

    // Fall logic
    if (!vclipActive && pos.y < -50) {
      const [spawnX, spawnY, spawnZ] = getPlayerSpawnPosition(DEFAULT_FALL_RECOVERY_SPAWN_POSITION);
      rigidBody.current.setTranslation({ x: spawnX, y: spawnY, z: spawnZ }, true);
      rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
      camera.position.set(spawnX, spawnY + PLAYER_CAMERA_HEIGHT, spawnZ);
    }

    // Sync network
    const syncInterval = getPlayerNetworkSyncInterval(activeGrabIds.current);
    if (nowMs - lastNetworkSync.current > syncInterval) {
      lastNetworkSync.current = nowMs;
      emitPlayerNetworkSync({
        activeGrabIds: activeGrabIds.current,
        camera,
        characterCustomization: storeState.characterCustomization,
        chargingHands: storeState.chargingHands,
        climbingLadder,
        effectiveGrounded,
        hasMovementInput,
        isCrouching,
        isSliding,
        isSprinting,
        isVoiceSpeaking: storeState.isVoiceSpeaking,
        pos,
        sleepActive,
        survivalLevel: storeState.survivalLevel,
        velocityY: velocity.y,
        yaw,
      });
    }
  });

  return (
    <>
      <RigidBody name="player" ref={rigidBody} collisionGroups={interactionGroups(1, [0])} colliders={false} mass={1} type="dynamic" position={initialPlayerPosition} enabledRotations={[false, false, false]} friction={0} restitution={0} ccd={true} gravityScale={isVClipEnabled ? 0 : 1}>
        {/* Collider height depends on whether sliding. But dynamic collider resizing can be tricky in Rapier. */}
        {/* We'll just stick to a fixed capsule and lower our camera, simple solution */}
        {!isVClipEnabled && <CapsuleCollider args={[PLAYER_COLLIDER_HALF_HEIGHT, PLAYER_COLLIDER_RADIUS]} friction={0} restitution={0} />}
        <pointLight 
          color="#ffd700" 
          intensity={showHealGlow ? 40 : 0} 
          distance={25} 
          decay={2}
          position={[0, 1, 0]}
        />
      </RigidBody>
    </>
  );
}
