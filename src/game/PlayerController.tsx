import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, useRapier, RapierRigidBody, interactionGroups } from "@react-three/rapier";
import * as THREE from "three";
import { ARMOR_MAX, DARREL_DRAGON_WORLD_POSITION, DEFAULT_MOUSE_SENSITIVITY, HandType, SpellType, SURVIVAL_BLOCK_SIZE, TOXIC_DAMAGE_PER_SECOND, useGameStore } from "../store/gameStore";
import {
  emitGameNetworkEvent,
  getConnectedNetworkPlayerId,
  getLocalNetworkPlayerId,
} from "./network/gameNetworkClient";
import {
  emitPlayerNetworkSyncIfDue,
  emitPlayerNetworkPoseSyncIfDue,
  resolvePlayerNetworkSyncFrame,
} from "./network/playerNetworkSync";
import { getPrimaryGamepad } from "./systems/input/controllerInput";
import {
  installMovementKeyboardListeners,
  isMouseGameplayInputActive,
  isMouseLookFallbackActive,
  keys,
  resetMovementKeys,
} from "./systems/input/playerInputState";
import {
  createPlayerLilyCoilTubeNavigationSampleInput,
  createPlayerNavigationSampleInput,
  isNavigationRecordingActive,
  recordNavigationSample,
} from "./navigationRecorderRuntime";
import {
  QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL,
  QA_SURVIVAL_COMBAT_TARGET_RANGE,
  QA_SURVIVAL_INSPECTION_MAX_INTERVAL,
  QA_SURVIVAL_INSPECTION_MIN_INTERVAL,
  QA_SURVIVAL_OVERHEAD_BLOCKED_CLEARANCE,
  QA_SURVIVAL_OVERHEAD_PROBE_DISTANCE,
  QA_SURVIVAL_OVERHEAD_SOFT_CLEARANCE,
  QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL,
  QA_SURVIVAL_VIEW_BLOCKED_CLEARANCE,
  QA_SURVIVAL_VIEW_SOFT_CLEARANCE,
  QA_SURVIVAL_WALK_BLOCKED_CLEARANCE,
  QA_SURVIVAL_WALK_LOOKAHEAD_DISTANCE,
  QA_SURVIVAL_WALK_PROBE_DISTANCE,
  QA_SURVIVAL_WALK_PROBE_HEIGHTS,
  QA_SURVIVAL_WALK_SOFT_CLEARANCE,
  QA_SURVIVAL_WALK_SOFT_LOOKAHEAD,
  QA_SURVIVAL_WALK_TURN_IN_PLACE_ERROR,
  angleDeltaRadians,
  getQaSpellDummies,
  getReadyQaManaFlowers,
  getQaSurvivalChunkCenter,
  getQaSurvivalRouteWaypoints,
  getQuestNavigationIntentTargets,
  isQaSpellDummyRunEnabled,
  isSurvivalGameMode,
  normalizeAngleRadians,
  pickQaQuestDialogChoice,
  publishQaPlayerPosition,
  randomRangeFromNoise,
  survivalishTurnNoise,
  type QaManaFlowerSnapshot,
  type QaSpellDummySnapshot,
  type QaSurvivalIntent,
  type QaSurvivalWalkMode,
} from "./tools/qa/survivalWalkQa";
import {
  applyQaWalkActiveIntentRefresh,
  applyQaWalkActiveIntentMovementFrame,
  applyQaWalkAvoidMovementFrame,
  applyQaWalkBlockedRecoveryTrigger,
  applyQaWalkClearanceThrottle,
  applyQaWalkCombatFocusMovementFrame,
  applyQaWalkInspectionStartPlan,
  applyQaWalkInspectMovementFrame,
  applyQaWalkIntentInteractionAction,
  applyQaWalkJumpHoldUntil,
  applyQaWalkLowSpeedRecovery,
  applyQaWalkManaFlowerCollectionAction,
  applyQaWalkOpenLaneRecoveryRelief,
  applyQaWalkProgressRecovery,
  applyQaWalkRecoveryMovementFrame,
  applyQaWalkRecoveryPlacementPlan,
  applyQaWalkRecoveryStartPlan,
  applyQaWalkRouteWaypointSelection,
  applyQaWalkRouteSteeringState,
  applyQaWalkSteeringDecisionFrame,
  applyQaWalkTubeMovementFrame,
  getQaWalkIntentDistance,
  isQaWalkBaseVillageArea,
  isQaWalkDarrelGroveArea,
  isQaWalkMovingInOpenLane,
  resolveQaWalkBaseVillageRoadRescuePosition,
  resolveQaWalkBaseVillageRoadWaypoint,
  resolveQaWalkDarrelDragonRouteAssistPosition,
  resolveQaWalkDarrelGroveRescuePosition,
  resolveQaWalkDarrelGroveWaypoint,
  resolveQaWalkIntentCompletionDistance,
  resolveQaWalkIntentChoice,
  resolveQaWalkIntentInteractionAction,
  resolveQaWalkIntentMoveTarget,
  resolveQaWalkActiveIntentRefresh,
  resolveQaWalkActiveIntentMovement,
  resolveQaWalkForwardWaypoint,
  resolveQaWalkInspectionStart,
  resolveQaWalkRoamWaypoint,
  resolveQaWalkAvoidMovement,
  resolveQaWalkBlockedRecoveryTrigger,
  resolveQaWalkClearanceThrottle,
  resolveQaWalkCombatFocusMovement,
  resolveQaWalkEscapeYawCandidate,
  resolveQaWalkInspectMovement,
  resolveQaWalkIntentJumpHoldUntil,
  resolveQaWalkLilyCoilTubeWaypoint,
  resolveQaWalkLookInputFrame,
  resolveQaWalkLowSpeedRecovery,
  resolveQaWalkManaFlowerCollectionAction,
  resolveQaWalkOpenLaneRecoveryRelief,
  resolveQaWalkProgressRecovery,
  resolveQaWalkRecoveryMovementFrame,
  resolveQaWalkRecoveryJumpHoldUntil,
  resolveQaWalkRecoveryRescuePlan,
  resolveQaWalkRecoveryStartPlan,
  resolveQaWalkSteeringDecisionFrame,
  resolveQaWalkTelemetryAbnormality,
  resolveQaWalkTelemetryMovement,
  resolveQaWalkRouteSteeringState,
  resolveQaWalkRouteWaypoint,
  resolveQaWalkTubeMovementFrame,
  resolveQaWalkTravelMovementFrame,
  resolveQaWalkUnstickNudgePlan,
  resolveQaWalkWaypointRefreshState,
  setQaSurvivalWalkStationaryInput,
  shouldResolveQaWalkSteeringDecision,
  shouldResolveQaWalkUnstickNudgePlan,
} from "./tools/qa/survivalWalkQaRuntime";
import { useQaSurvivalWalkRuntimeState } from "./tools/qa/survivalWalkQaRuntimeState";
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
import {
  applyQaWalkCombatCastDecision,
  applyQaWalkPracticeCast,
  applyQaWalkPracticeCastDecision,
  getQaWalkPracticeCastHand,
  resolveQaWalkCombatCastDecision,
  resolveQaWalkPracticeCastDecision,
  resolveQaWalkPracticeProjectilePosition,
} from "./tools/qa/survivalWalkQaPracticeCasting";
import {
  applyQaWalkSpellDummyReanchorPlan,
  getQaWalkNextCombatCastAt,
  getQaWalkNextPracticeCastAt,
  applyQaWalkSpellDummyRunMotionBrake,
  resolveQaWalkSpellDummyReanchorPlan,
  resolveQaWalkSpellDummyTargets,
  shouldReanchorQaWalkSpellDummy,
} from "./tools/qa/survivalWalkQaSpellDummyRuntime";
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
import {
  usePlayerControllerRuntimeState,
  type GrabbedPlayerState,
} from "./systems/player/playerControllerRuntimeState";
import {
  applyPlayerSpawnOverrideAction,
  resolvePlayerSpawnOverrideAction,
} from "./systems/player/playerSpawnOverrideRuntime";
import {
  applyPlayerTeleportEventApplication,
  resolvePlayerTeleportEventAction,
} from "./systems/player/playerTeleportRuntime";
import {
  applyPlayerPullEventAction,
  resolvePlayerPullEventAction,
} from "./systems/player/playerPullRuntime";
import {
  readPlayerControllerGamepadLookInput,
  readPlayerControllerGamepadMovementInput,
  updatePlayerControllerGamepadArming,
} from "./systems/player/playerControllerGamepadRuntime";
import {
  applyPlayerFloorRecovery,
  applyPlayerFallRecovery,
  getPlayerFloorRecoveryTarget,
  hasPlayerGroundHit,
  resolvePlayerFloorRecoveryGate,
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
import { applyPlayerDeadCastRespawn } from "./systems/player/playerControllerCastingRuntime";
import { installPlayerLadderZoneListeners } from "./systems/player/playerLadderZones";
import { installPlayerMouseLookFallback } from "./systems/player/playerMouseLookRuntime";
import {
  applyPlayerScreenShake,
  applyPlayerScreenShakeEvent,
} from "./systems/player/playerScreenShakeRuntime";
import {
  applyPlayerClearToxicEffectsWithNetwork,
  applyPlayerToxicDamageFrameResult,
  updatePlayerToxicDamageFrame,
} from "./systems/player/playerToxicDamageRuntime";
import {
  applyPlayerTouchControlEvent,
  applyPlayerTouchHotbarEvent,
  readPlayerTouchCastEvent,
} from "./systems/player/playerTouchInputRuntime";
import {
  LILY_COIL_TUBE_PLAYER_RADIUS,
  QA_LILY_COIL_TUBE_LOOK_AHEAD_T,
  QA_LILY_COIL_TUBE_RESTART_EDGE_T,
  QA_LILY_COIL_TUBE_REVERSE_EDGE_T,
  applyPlayerLilyCoilTubeJumpThrusterFrame,
  applyPlayerLilyCoilTubePlacementFrame,
  applyPlayerLilyCoilTubeSlideFrame,
  getPlayerLilyCoilTubeDispatchState,
  isPlayerLilyCoilTubeMoving,
  resolvePlayerLilyCoilTubeNetworkFrame,
} from "./systems/player/playerLilyCoilTubeRuntime";
import {
  canUsePlayerControllerMode,
  canUsePlayerGameplayInput,
} from "./systems/player/playerGameplayInputGate";
import {
  applyPlayerAstralMeditationFrame,
  handlePlayerMeditationKeyDown,
  handlePlayerMeditationKeyUp,
  updatePlayerMeditationExitHold,
} from "./systems/player/playerAstralMeditationRuntime";
import {
  applyPlayerModalBlockedMovementFrame,
  applyPlayerGroundSlideFrame,
  applyPlayerJumpThrusterFrame,
  applyPlayerMovementModifierFrame,
  applyPlayerMovementVelocityFrame,
  applyPlayerPlanarMovementDirectionFrame,
  resetPlayerCrouchState,
  resetPlayerSlideAndCrouchState,
  resetPlayerSlideState,
  resolvePlayerMovementInputIntent,
  resolvePlayerMovementMotionState,
  stopPlayerPlanarVelocity,
  updatePlayerCrouchHoldState,
} from "./systems/player/playerMovementInputRuntime";
import {
  applyPlayerLookInputFrame,
  isPlayerLookInputAllowed,
  resolvePlayerLookInputFrame,
} from "./systems/player/playerLookInputRuntime";
import {
  PLAYER_CASTING_HANDS,
  applyPlayerHealSpellFrame,
  canPlayerHandCastNow,
  clearPlayerCastingHandState,
  consumePlayerHandFrameTimer,
  getPlayerSpellForHand,
  hasPlayerRunePowerForHand,
  isPlayerReleaseSelfBuffSpell,
  isPlayerReleaseSuppressedSpell,
  isPlayerSelfBuffSpell,
  pulsePlayerHandCharging,
  resetPlayerCastingHandFrameGate,
  resetPlayerCastingHandsRuntime,
  resetPlayerControllerAfterCastRelease,
  stopPlayerCastingHands,
} from "./systems/player/playerHandCastingRuntime";
import {
  applyPlayerGrabCast,
  applyPlayerGrabRelease,
  clearPlayerGrabTimeouts,
} from "./systems/player/playerGrabCastingRuntime";
import {
  applyPlayerKeyboardHotbarAction,
  applyPlayerWheelSpellAction,
  resolvePlayerKeyboardHotbarAction,
  resolvePlayerWheelSpellAction,
} from "./systems/player/playerHotbarInputRuntime";
import {
  isPlayerMouseCastButton,
  resolvePlayerContextMenuAction,
  resolvePlayerMouseCastAction,
  resolvePlayerMouseReleaseAction,
} from "./systems/player/playerMouseCastInputRuntime";
import {
  applyPlayerGrabbedFollowFrame,
  applyPlayerGrabStartEventDetail,
  applyPlayerGrabControlEventDetail,
  applyPlayerGrabReleaseEventDetail,
  throwPlayerGrabbedState,
} from "./systems/player/playerGrabEventRuntime";
import {
  PLAYER_DIRECT_STATUS_HAND_CHARGE_MS,
  applyPlayerDirectStatusCast,
} from "./systems/player/playerDirectStatusCastingRuntime";
import {
  applyPlayerSelfBuffSpellCast,
} from "./systems/player/playerSelfBuffCastingRuntime";
import {
  createPlayerStateDispatchSnapshot,
  dispatchPlayerLilyCoilTubeMovementFrame,
  dispatchPlayerMoved,
  dispatchPlayerMovementFrame,
  dispatchPlayerState,
  dispatchStationaryPlayerState,
  dispatchDirectStatusCast,
  dispatchQuestVillagerInteraction,
  dispatchReleaseGrabPlayer,
  dispatchSelfBuffCast,
  publishLastPlayerYaw,
  publishLastTeleportPosition,
  publishLocalPlayerRigidBody,
  publishLocalPlayerPosition,
  publishPlayerLilyCoilTubeState,
} from "./systems/player/playerEventBridge";
import {
  applyPlayerBlinkTeleport,
  applyFlamethrowerSpreadInto,
  applyPlayerImmediateSpellProjectileCast,
  applyPlayerReleasedSpellProjectile,
  applyPlayerSpellProjectileNetworkCast,
  createPlayerGrabProjectileId,
  findPlayerDirectStatusTargetInto,
  getPlayerSpellLaunch,
  getPlayerSpellLaunchInto,
  getPlayerReleasedSpellLaunchInto,
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
  const qaSpellDummySnapshotScratch = useRef<QaSpellDummySnapshot[]>([]);
  const qaManaFlowerSnapshotScratch = useRef<QaManaFlowerSnapshot[]>([]);
  const qaManaFlowerCooldownScratch = useRef(new Map<string, number>());
  const readQaSpellDummiesScratch = () => getQaSpellDummies(qaSpellDummySnapshotScratch.current);
  const readReadyQaManaFlowersScratch = () => getReadyQaManaFlowers(
    qaManaFlowerSnapshotScratch.current,
    qaManaFlowerCooldownScratch.current,
  );

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
    applyPlayerClearToxicEffectsWithNetwork({
      acidUntil: state.acidUntil,
      connectedPlayerId: getConnectedNetworkPlayerId(),
      nowMs: getPlayerEventEpochMs(),
      poisonUntil: state.poisonUntil,
    }, {
      clearToxicEffects: state.clearToxicEffects,
      emitGameNetworkEvent,
    });
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
    throwPlayerGrabbedState({
      body: rigidBody.current,
      grabbedState,
      maxVerticalSpeed: 26,
      minVerticalSpeed: -18,
      overrideDirection: overrideDir,
      speed: GRAB_THROW_SPEED,
      throwDirection,
    });
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
      return applyPlayerSelfBuffSpellCast({
        spell,
        hand,
        armorMax: ARMOR_MAX,
        jumpVelocityFloor: JUMP_FORCE * JUMP_BOOST_MULTIPLIER,
      }, {
        setHandCharging: (targetHand, charging) => {
          useGameStore.getState().setHandCharging(targetHand, charging);
        },
        setTimeout: (handler, timeoutMs) => window.setTimeout(handler, timeoutMs),
        activateMagicArmor: store.activateMagicArmor,
        activateSpeedBoost: store.activateSpeedBoost,
        activateJumpBoost: store.activateJumpBoost,
        activateMagicGlassOrb: store.activateMagicGlassOrb,
        getJumpVelocity: () => rigidBody.current?.linvel(),
        setJumpVelocity: velocity => {
          rigidBody.current?.setLinvel(velocity, true);
        },
        emitGameNetworkEvent,
        dispatchSelfBuffCast,
      });
    };

    const castDirectTungston = (hand: HandType) => {
      const store = useGameStore.getState();

      pulsePlayerHandCharging(hand, PLAYER_DIRECT_STATUS_HAND_CHARGE_MS, {
        setHandCharging: (targetHand, charging) => useGameStore.getState().setHandCharging(targetHand, charging),
        setTimeout: (handler, timeoutMs) => window.setTimeout(handler, timeoutMs),
      });

      const target = findPlayerDirectStatusTargetInto({
        players: store.players,
        hand,
        camera,
        direction: spellDirection,
        launchTarget: spellLaunchScratch,
        aimOrigin: spellAimOrigin,
        launchOrigin: spellLaunchOrigin,
        targetScratch: spellTargetScratch,
      });
      if (!target) {
        return false;
      }

      return applyPlayerDirectStatusCast({
        spell: "tungstonballsack",
        hand,
        targetId: target.id,
        nowMs: getPlayerEventEpochMs(),
      }, {
        updatePlayer: store.updatePlayer,
        emitGameNetworkEvent,
        dispatchDirectStatusCast,
      });
    };

    const stopHandCasting = (hand: HandType) => {
      clearPlayerCastingHandState(activeCastingHands, hand, useGameStore.getState().setHandCharging);
    };

    const emitGrabRelease = (hand: HandType) => {
      const dir = spellDirection;
      camera.getWorldDirection(dir);
      const { spawnPos, realDir } = getPlayerSpellLaunchInto(hand, camera, dir, spellLaunchScratch);
      const releaseOrigin = { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };

      applyPlayerGrabRelease({
        activeGrabIds: activeGrabIds.current,
        addProjectile: useGameStore.getState().addProjectile,
        creatorId: getLocalNetworkPlayerId(),
        direction: { x: realDir.x, y: realDir.y, z: realDir.z },
        dispatchReleaseGrabPlayer,
        emitGameNetworkEvent,
        grabTimeouts: grabTimeouts.current,
        hand,
        origin: releaseOrigin,
        releasedAt: getPlayerEventEpochMs(),
      });
    };

    const stopAllCasting = () => {
      stopPlayerCastingHands(PLAYER_CASTING_HANDS, { emitGrabRelease, stopHandCasting });
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
      const deadRespawn = applyPlayerDeadCastRespawn({
        body: rigidBody.current,
        camera,
        cameraHeight: PLAYER_CAMERA_HEIGHT,
        getSpawnPosition: getPlayerSpawnPosition,
        health: getHealth(),
        lastFire,
        nowMs: now,
        respawn: useGameStore.getState().respawn,
      });
      if (deadRespawn.blocked) {
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
        applyPlayerGrabCast({
          activeGrabIds: activeGrabIds.current,
          addProjectile: useGameStore.getState().addProjectile,
          controlAimDir: { x: d.x, y: d.y, z: d.z },
          controlOrigin: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          createdAt: now,
          creatorId: getLocalNetworkPlayerId(),
          direction: { x: realDir.x, y: realDir.y, z: realDir.z },
          emitGameNetworkEvent,
          grabId,
          grabTimeouts: grabTimeouts.current,
          hand,
          maxDurationMs: GRAB_MAX_DURATION_MS,
          onTimeout: () => {
            emitGrabRelease(hand);
            stopHandCasting(hand);
          },
          origin: projectileOrigin,
          setTimeoutFn: (handler, timeoutMs) => window.setTimeout(handler, timeoutMs),
        });
        return;
      }

      if (spell === 'iceshard' || spell === 'arcanebeam') {
        const r = rigidBody.current;
        if (r) {
          lastFire[hand] = now;
          applyPlayerImmediateSpellProjectileCast({
            addProjectile: useGameStore.getState().addProjectile,
            camera,
            createdAt: now,
            creatorId: getLocalNetworkPlayerId(),
            direction: spellDirection,
            emitGameNetworkEvent,
            hand,
            target: spellLaunchScratch,
            type: spell,
          });
        }
      }
    };

    const isMouseCastSurfaceBlocked = () => {
      const state = useGameStore.getState();
      return Boolean(state.questNpcEditorTarget || state.questDialogSession || state.isInventoryOpen);
    };

    const onMouseDown = (e: MouseEvent) => {
      const surfaceBlocked = isMouseCastSurfaceBlocked();
      const gameplayInputAllowed = canUseGameplayInput();
      const questInteractionHandled = !surfaceBlocked &&
        gameplayInputAllowed &&
        isPlayerMouseCastButton(e.button) &&
        requestQuestVillagerInteraction();
      const mouseAction = resolvePlayerMouseCastAction(e.button, {
        gameplayInputAllowed,
        questInteractionHandled,
        surfaceBlocked,
      });
      if (mouseAction.type === "prevent-default") {
        e.preventDefault();
        return;
      }
      if (mouseAction.type === "start") startHandCast(mouseAction.hand);
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
      
      const { spawnPos, realDir } = getPlayerReleasedSpellLaunchInto({
        type: currentSpell,
        hand,
        camera,
        playerPosition: pos,
        direction: spellDirection,
        flatDirection: spellFlatDirection,
        target: spellLaunchScratch,
        footOffset: PLAYER_FOOT_OFFSET,
      });
      const projectileOrigin = { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z };
      const projectileDir = { x: realDir.x, y: realDir.y, z: realDir.z };
      
      if (currentSpell === 'blink') {
        applyPlayerBlinkTeleport({
          body: r,
          position: pos,
        });
      }

      applyPlayerReleasedSpellProjectile({
        addProjectile: useGameStore.getState().addProjectile,
        createdAt: releasedAt,
        creatorId: getLocalNetworkPlayerId(),
        emitGameNetworkEvent,
        type: currentSpell,
        pos: projectileOrigin,
        dir: projectileDir,
        hand,
      });
    };

    const onMouseUp = (e: MouseEvent) => {
      const mouseAction = resolvePlayerMouseReleaseAction(e.button, isMouseCastSurfaceBlocked());
      if (mouseAction.type === "release") releaseHandCast(mouseAction.hand);
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
      const wheelAction = resolvePlayerWheelSpellAction(e.deltaY, {
        gameplayInputAllowed: canUseGameplayInput(),
        isMagicArmed: store.isMagicArmed,
        isSpellMenuOpen: store.isSpellMenuOpen,
        rightHandModifierHeld: keys.KeyQ,
      });
      applyPlayerWheelSpellAction(wheelAction, store);
    };

    const onHotbarKeyDown = (e: KeyboardEvent) => {
      const store = useGameStore.getState();
      const hotbarAction = resolvePlayerKeyboardHotbarAction(e.code, {
        gameplayInputAllowed: canUseGameplayInput(),
        health: store.health,
        isMagicArmed: store.isMagicArmed,
        isSpellMenuOpen: store.isSpellMenuOpen,
        rightHandModifierHeld: keys.KeyQ,
      });
      if (hotbarAction.type !== "select") return;

      e.preventDefault();
      applyPlayerKeyboardHotbarAction(hotbarAction, store);
    };

    const onContextMenu = (e: MouseEvent) => {
      if (resolvePlayerContextMenuAction(canUseGameplayInput()).type === "prevent-default") {
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
      applyPlayerTeleportEventApplication(resolvePlayerTeleportEventAction(e.detail), {
        body: rigidBody.current,
        camera,
        cameraHeight: PLAYER_CAMERA_HEIGHT,
        dispatchPlayerMoved,
        getNowMs: getPlayerEventEpochMs,
        publishLastTeleportPosition,
        publishLocalPlayerPosition,
        publishManualFastTravelSpawn,
        publishQaPlayerPosition,
        resetCameraYaw: resetLilyCoilCameraState,
        resetQaWalkSession,
        setForcedSpawnKey: key => {
          forcedSpawnKey.current = key;
        },
      });
    };

    const onPull = (e: any) => {
      applyPlayerPullEventAction(
        resolvePlayerPullEventAction(e.detail),
        pullVelocity.current,
        pullFrames,
      );
    };

    const onScreenShake = (e: any) => {
      applyPlayerScreenShakeEvent(screenShake.current, e.detail, getPlayerEventEpochMs());
    };

    const onGrabPlayer = (e: any) => {
      applyPlayerGrabStartEventDetail(e.detail, {
        createState: (): GrabbedPlayerState => ({
          casterId: "",
          grabId: undefined,
          dir: new THREE.Vector3(),
          origin: new THREE.Vector3(),
          distance: GRAB_DEFAULT_DISTANCE,
          lastControlAt: 0,
          until: 0,
        }),
        defaultDistance: GRAB_DEFAULT_DISTANCE,
        fallbackOrigin: camera.position,
        grabbedState,
        localPlayerId: getLocalNetworkPlayerId(),
        maxDurationMs: GRAB_MAX_DURATION_MS,
        nowMs: getPlayerEventEpochMs(),
      });
    };

    const onGrabControl = (e: any) => {
      applyPlayerGrabControlEventDetail(e.detail, grabbedState, getPlayerEventEpochMs());
    };

    const onReleaseGrabPlayer = (e: any) => {
      applyPlayerGrabReleaseEventDetail(e.detail, {
        grabbedState,
        releaseDirection: grabReleaseDirection,
        throwGrabbedPlayer,
      });
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
      clearPlayerGrabTimeouts(grabTimeouts.current, PLAYER_CASTING_HANDS);
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

    const spawnOverrideAction = resolvePlayerSpawnOverrideAction({
      forcedSpawnKey: forcedSpawnKey.current,
      spawnOverride: getPlayerSpawnOverride(),
    });
    const spawnOverrideApplication = applyPlayerSpawnOverrideAction(spawnOverrideAction, {
      body: rigidBody.current,
      camera,
      cameraHeight: PLAYER_CAMERA_HEIGHT,
      dispatchPlayerMoved,
      publishLocalPlayerPosition,
      publishQaPlayerPosition,
      resetCameraState: resetLilyCoilCameraState,
      resetQaWalkSession,
      setForcedSpawnKey: key => {
        forcedSpawnKey.current = key;
      },
    });
    if (spawnOverrideApplication.applied) {
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
      const toxicDamageApplication = applyPlayerToxicDamageFrameResult(toxicDamageFrame, {
        connectedPlayerId,
        emitGameNetworkEvent,
        setHealth: useGameStore.getState().setHealth,
      });
      health = toxicDamageApplication.health;
      if (toxicDamageApplication.shouldStopFrame) return;
    }

    const activeGrab = grabbedState.current;
    if (activeGrab) {
      resetPlayerCrouchState({ crouchHoldStartedAt, isCrouching, setIsCrouching });
      const grabbedFollowFrame = applyPlayerGrabbedFollowFrame({
        aimScratch: spellDirection,
        applyScreenShake,
        body: rigidBody.current,
        camera,
        cameraHeight: PLAYER_CAMERA_HEIGHT,
        cameraTargetPosition: cameraTargetPosition.current,
        caster: storeState.players[activeGrab.casterId],
        casterAnchor: grabbedCasterAnchor,
        currentPosition: grabbedCurrentPosition,
        deltaSeconds: delta,
        dispatchPlayerMoved,
        dispatchStationaryPlayerState: () => {
          dispatchStationaryPlayerState(lastDispatchedPlayerStateRef.current);
        },
        followSpeed: GRAB_FOLLOW_SPEED,
        frameForward,
        grabbed: activeGrab,
        holdPoint: grabbedHoldPoint,
        lastNetworkSync,
        networkSyncIntervalMs: 1000 / 30,
        nowMs,
        playerPosition: pos,
        publishLocalPlayerPosition,
        resolveCasterAimDirection: getPlayerAimDirectionInto,
      });

      if (grabbedFollowFrame.type === "expired") {
        throwGrabbedPlayer();
        return;
      }

      emitPlayerNetworkPoseSyncIfDue({
        anim: "grabbed",
        camera,
        characterCustomization: storeState.characterCustomization,
        isVoiceSpeaking: storeState.isVoiceSpeaking,
        pos: grabbedFollowFrame.position,
        shouldSyncNetwork: grabbedFollowFrame.shouldSyncNetwork,
        survivalLevel: storeState.survivalLevel,
        yaw: grabbedFollowFrame.yaw,
      });
      return;
    }

    if (astralActive) {
      resetPlayerSlideAndCrouchState({
        crouchHoldStartedAt,
        isCrouching,
        isSliding,
        setIsCrouching,
        setIsSliding,
      });
      resetPlayerCastingHandsRuntime({
        activeCastingHands,
        chargingHands: storeState.chargingHands,
        flamethrowerTimers,
        hands: PLAYER_CASTING_HANDS,
        setHandCharging: useGameStore.getState().setHandCharging,
      });

      stopPlayerPlanarVelocity({
        body: rigidBody.current,
        currentVelocityY: velocity.y,
        vclipActive,
      });
      const astralFrame = applyPlayerAstralMeditationFrame({
        applyScreenShake,
        camera,
        cameraHeight: PLAYER_MEDITATION_CAMERA_HEIGHT,
        cameraLerpAlpha: 0.18,
        cameraTargetPosition: cameraTargetPosition.current,
        dispatchPlayerMoved,
        dispatchStationaryPlayerState: () => {
          dispatchStationaryPlayerState(lastDispatchedPlayerStateRef.current, {
            isGrounded: true,
            isMeditating: true,
          });
        },
        frameForward,
        lastNetworkSync,
        networkSyncIntervalMs: 1000 / 15,
        nowMs,
        playerPosition: pos,
        publishLocalPlayerPosition,
      });

      emitPlayerNetworkPoseSyncIfDue({
        anim: "meditate",
        camera,
        characterCustomization: storeState.characterCustomization,
        isVoiceSpeaking: storeState.isVoiceSpeaking,
        pos: astralFrame.position,
        shouldSyncNetwork: astralFrame.shouldSyncNetwork,
        survivalLevel: storeState.survivalLevel,
        yaw: astralFrame.yaw,
      });
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
        setQaSurvivalWalkStationaryInput(qaWalkInputState.current);
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
          setQaSurvivalWalkStationaryInput(qaWalkInputState.current);
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
        const tubeWaypoint = resolveQaWalkLilyCoilTubeWaypoint({
          active: lilyCoilTubeQaActive,
          elapsedSeconds: elapsed,
          frameScratch: lilyCoilLookFrame,
          position: pos,
          tubeDirection: qaWalkLilyTubeDirection.current,
          tubeT: nearestTube.t,
        });
        if (!tubeWaypoint) return false;
        qaWalkWaypoint.current = tubeWaypoint;
        return true;
      };
      const isBaseVillageQaArea = isQaWalkBaseVillageArea({
        chunkCenterX,
        chunkCenterZ,
        position: pos,
      });
      const isDarrelGroveQaArea = isQaWalkDarrelGroveArea({
        chunkCenterX,
        chunkCenterZ,
      });
      const setDarrelGroveWaypoint = () => {
        const groveWaypoint = resolveQaWalkDarrelGroveWaypoint({
          active: isDarrelGroveQaArea,
          chunkCenterX,
          chunkCenterZ,
          elapsedSeconds: elapsed,
          position: pos,
        });
        if (!groveWaypoint) return false;
        qaWalkWaypoint.current = groveWaypoint;
        return true;
      };
      const getDarrelGroveRescuePosition = () => {
        return resolveQaWalkDarrelGroveRescuePosition({
          active: isDarrelGroveQaArea,
          chunkCenterX,
          chunkCenterZ,
          currentIntent: qaWalkIntent.current,
          localX: localFromCenterX,
          localZ: localFromCenterZ,
          position: pos,
        });
      };
      const getDarrelDragonRouteAssistPosition = () => {
        return resolveQaWalkDarrelDragonRouteAssistPosition({
          active: isDarrelGroveQaArea,
          chunkCenterX,
          chunkCenterZ,
          currentIntent: qaWalkIntent.current,
          localX: localFromCenterX,
          localZ: localFromCenterZ,
          position: pos,
        });
      };
      const setBaseVillageRoadWaypoint = () => {
        const roadWaypoint = resolveQaWalkBaseVillageRoadWaypoint({
          active: isBaseVillageQaArea,
          currentYaw: qaWalkYaw.current ?? currentYaw,
          elapsedSeconds: elapsed,
          position: pos,
        });
        if (!roadWaypoint) return false;
        qaWalkWaypoint.current = roadWaypoint;
        return true;
      };
      const getBaseVillageRoadRescuePosition = () => {
        return resolveQaWalkBaseVillageRoadRescuePosition({
          active: isBaseVillageQaArea,
          position: pos,
        });
      };
      const setRouteWaypoint = () => {
        const routeSelection = resolveQaWalkRouteWaypoint({
          active: qaRouteActive,
          elapsedSeconds: elapsed,
          position: pos,
          routeIndex: qaWalkRouteIndex.current,
          waypoints: qaRouteWaypoints,
        });
        return applyQaWalkRouteWaypointSelection({
          elapsedSeconds: elapsed,
          refs: {
            intent: qaWalkIntent,
            inspectUntil: qaWalkInspectUntil,
            nextInspectAt: qaWalkNextInspectAt,
            routeIndex: qaWalkRouteIndex,
            waypoint: qaWalkWaypoint,
          },
          selection: routeSelection,
        });
      };
      const intentDistance = (intent: QaSurvivalIntent | null) => getQaWalkIntentDistance(intent, pos);
      const questIntentTargets = getQuestNavigationIntentTargets();
      const getIntentMoveTarget = (intent: QaSurvivalIntent) => resolveQaWalkIntentMoveTarget({
        chunkCenterX,
        chunkCenterZ,
        intent,
        isDarrelGroveQaArea,
        position: pos,
      });
      const intentCompletionDistance = (intent: QaSurvivalIntent) => resolveQaWalkIntentCompletionDistance({
        intent,
        manaFlowers: readReadyQaManaFlowersScratch(),
      });
      const maybeChooseIntent = (force = false) => {
        void force;
        const lowestRunePower = Math.min(storeState.leftRunePower, storeState.rightRunePower);
        const intentChoice = resolveQaWalkIntentChoice({
          currentIntent: qaWalkIntent.current,
          darrelDragonWorldPosition: DARREL_DRAGON_WORLD_POSITION,
          elapsedSeconds: elapsed,
          interestMemory: qaWalkInterestMemory.current,
          isDarrelGroveQaArea,
          lowestRunePower,
          manaFlowers: readReadyQaManaFlowersScratch(),
          position: pos,
          qaSpellDummyRunActive,
          questTargets: questIntentTargets,
          spellDummies: readQaSpellDummiesScratch(),
        });
        qaWalkIntent.current = intentChoice.intent;
        if (intentChoice.nextIntentAt !== null) {
          qaWalkNextIntentAt.current = intentChoice.nextIntentAt;
        }
        if (intentChoice.memoryKey) {
          qaWalkInterestMemory.current[intentChoice.memoryKey] = intentChoice.memorySeenAt;
        }
        if (intentChoice.waypoint) {
          qaWalkWaypoint.current = intentChoice.waypoint;
        }
        return intentChoice.intent;
      };
      const chooseNewWaypoint = (preferCenter = false) => {
        if (setLilyCoilTubeWaypoint()) return;
        if (setRouteWaypoint()) return;
        const shouldPrioritizeDummyIntent = qaSpellDummyRunActive && readQaSpellDummiesScratch().length > 0;
        if ((!preferCenter || shouldPrioritizeDummyIntent) && maybeChooseIntent(shouldPrioritizeDummyIntent || elapsed >= qaWalkNextIntentAt.current)) return;
        if (setDarrelGroveWaypoint()) return;
        if (setBaseVillageRoadWaypoint()) return;

        qaWalkWaypoint.current = resolveQaWalkRoamWaypoint({
          blockSize: SURVIVAL_BLOCK_SIZE,
          chunkCenterX,
          chunkCenterZ,
          currentYaw: qaWalkYaw.current ?? currentYaw,
          elapsedSeconds: elapsed,
          maxLocalDistance,
          position: pos,
          preferCenter,
        });
      };

      const setForwardQaWaypoint = (yaw: number, distance?: number) => {
        qaWalkWaypoint.current = resolveQaWalkForwardWaypoint({
          distance,
          elapsedSeconds: elapsed,
          position: pos,
          yaw,
        });
      };

      const waypointRefresh = resolveQaWalkWaypointRefreshState({
        blockSize: SURVIVAL_BLOCK_SIZE,
        elapsedSeconds: elapsed,
        maxLocalDistance,
        position: pos,
        qaRouteActive,
        waypoint: qaWalkWaypoint.current,
      });
      const waypointDistance = waypointRefresh.waypointDistance;
      if (waypointRefresh.shouldRefresh) {
        chooseNewWaypoint(waypointRefresh.preferCenter);
      }
      const activeIntentRefresh = resolveQaWalkActiveIntentRefresh({
        currentIntent: qaWalkIntent.current,
        elapsedSeconds: elapsed,
        qaRouteActive,
        qaSpellDummyRunActive,
        spellDummies: readQaSpellDummiesScratch(),
      });
      const activeIntent = applyQaWalkActiveIntentRefresh({
        chooseIntent: () => maybeChooseIntent(true),
        refs: {
          intent: qaWalkIntent,
          nextIntentAt: qaWalkNextIntentAt,
        },
        refresh: activeIntentRefresh,
      });
      const activeIntentDistance = intentDistance(activeIntent);

      const inspectionStart = resolveQaWalkInspectionStart({
        currentYaw: qaWalkYaw.current ?? currentYaw,
        elapsedSeconds: elapsed,
        hasCurrentIntent: qaWalkIntent.current !== null,
        hasSpellDummies: readQaSpellDummiesScratch().length > 0,
        inspectUntil: qaWalkInspectUntil.current,
        lilyCoilTubeQaActive,
        nextInspectAt: qaWalkNextInspectAt.current,
        position: pos,
        qaRouteActive,
        qaSpellDummyRunActive,
        recoveryUntil: qaWalkRecoveryUntil.current,
        stuckStrikes: qaWalkStuckStrikes.current,
      });
      applyQaWalkInspectionStartPlan({
        plan: inspectionStart,
        refs: {
          inspectUntil: qaWalkInspectUntil,
          inspectYaw: qaWalkInspectYaw,
          nextInspectAt: qaWalkNextInspectAt,
        },
      });

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

      const findEscapeYaw = (baseYaw: number, preferYaw: number) => {
        return resolveQaWalkEscapeYawCandidate({
          baseYaw,
          preferYaw,
          probeClearance,
        });
      };

      const beginQaWalkRecovery = (aggressive = false) => {
        if (aggressive) chooseNewWaypoint(true);
        const baseYaw = qaWalkYaw.current ?? currentYaw;
        const preferYaw = Math.atan2(qaWalkWaypoint.current.x - pos.x, -(qaWalkWaypoint.current.z - pos.z));
        const escape = findEscapeYaw(baseYaw, preferYaw);
        const recoveryStartPlan = resolveQaWalkRecoveryStartPlan({
          elapsedSeconds: elapsed,
          escapeLeftClearance: escape.left,
          escapeRightClearance: escape.right,
          escapeYaw: escape.yaw,
          positionX: pos.x,
          positionZ: pos.z,
          stuckStrikes: qaWalkStuckStrikes.current,
        });
        applyQaWalkRecoveryStartPlan({
          elapsedSeconds: elapsed,
          plan: recoveryStartPlan,
          position: pos,
          refs: {
            inspectUntil: qaWalkInspectUntil,
            lastDecisionAt: qaWalkLastDecisionAt,
            nextDecisionAt: qaWalkNextDecisionAt,
            recoveryStartedAt: qaWalkRecoveryStartedAt,
            recoveryStartPos: qaWalkRecoveryStartPos,
            recoveryStrafe: qaWalkRecoveryStrafe,
            recoveryUntil: qaWalkRecoveryUntil,
            recoveryYaw: qaWalkRecoveryYaw,
          },
        });
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
      const travelMovementFrame = resolveQaWalkTravelMovementFrame({
        desiredYaw,
        elapsedSeconds: elapsed,
        forwardClearance,
        forwardLookAhead,
        positionX: pos.x,
        positionZ: pos.z,
        viewClearance,
      });
      let mode: QaSurvivalWalkMode = qaRouteActive ? "route" : "travel";
      let targetYaw = travelMovementFrame.targetYaw;
      let forwardAmount = travelMovementFrame.forwardAmount;
      let strafeAmount = travelMovementFrame.strafeAmount;
      let recoveryReason = "";
      let sprint = travelMovementFrame.sprint;
      const routeSteeringApplication = applyQaWalkRouteSteeringState({
        current: {
          forwardAmount,
          sprint,
          strafeAmount,
          targetYaw,
        },
        refs: {
          routeBlockedSince: qaWalkRouteBlockedSince,
          routeSmoothedYaw: qaWalkRouteSmoothedYaw,
          routeTargetId: qaWalkRouteTargetId,
        },
        steering: routeSteering,
      });
      targetYaw = routeSteeringApplication.targetYaw;
      forwardAmount = routeSteeringApplication.forwardAmount;
      strafeAmount = routeSteeringApplication.strafeAmount;
      sprint = routeSteeringApplication.sprint;
      const routeHardBlocked = routeSteeringApplication.routeHardBlocked;
      const routeBlockDwelled = routeSteeringApplication.routeBlockDwelled;
      const tubeMovementFrame = resolveQaWalkTubeMovementFrame({
        elapsedSeconds: elapsed,
        positionX: pos.x,
        positionY: pos.y,
        tubeDirection: qaWalkLilyTubeDirection.current,
        tubeT: lilyCoilTubeTravelState?.t ?? 0,
        tubeTravelYaw: lilyCoilTubeTravelYaw,
      });
      const tubeMovementApplication = applyQaWalkTubeMovementFrame({
        current: {
          forwardAmount,
          sprint,
          strafeAmount,
          targetYaw,
        },
        frame: tubeMovementFrame,
      });
      if (tubeMovementApplication.applied) {
        targetYaw = tubeMovementApplication.targetYaw;
        forwardAmount = tubeMovementApplication.forwardAmount;
        strafeAmount = tubeMovementApplication.strafeAmount;
        sprint = tubeMovementApplication.sprint;
      }

      const needsDecision = shouldResolveQaWalkSteeringDecision({
        elapsedSeconds: elapsed,
        forwardClearance,
        forwardLookAhead,
        lastDecisionAt: qaWalkLastDecisionAt.current,
        lilyCoilTubeQaActive,
        nextDecisionAt: qaWalkNextDecisionAt.current,
        overheadClearance,
        qaRouteActive,
        routeBlockDwelled,
        viewClearance,
      });

      if (needsDecision) {
        const steeringDecisionFrame = resolveQaWalkSteeringDecisionFrame({
          desiredYaw,
          elapsedSeconds: elapsed,
          initialStrafeAmount: strafeAmount,
          positionX: pos.x,
          positionZ: pos.z,
          probeClearance,
          qaRouteActive,
          targetYaw,
        });
        const appliedSteeringDecision = applyQaWalkSteeringDecisionFrame({
          frame: steeringDecisionFrame,
          refs: {
            lastDecisionAt: qaWalkLastDecisionAt,
            nextDecisionAt: qaWalkNextDecisionAt,
          },
        });
        targetYaw = appliedSteeringDecision.targetYaw;
        strafeAmount = appliedSteeringDecision.strafeAmount;
      }

      const blockedRecoveryTrigger = resolveQaWalkBlockedRecoveryTrigger({
        elapsedSeconds: elapsed,
        forwardClearance,
        lilyCoilTubeQaActive,
        overheadClearance,
        qaRouteActive,
        recoveryUntil: qaWalkRecoveryUntil.current,
        routeBlockDwelled,
        routeHardBlocked,
        viewClearance,
      });
      const blockedRecoveryApplication = applyQaWalkBlockedRecoveryTrigger({
        currentRecoveryReason: recoveryReason,
        publishers: { beginRecovery: beginQaWalkRecovery },
        trigger: blockedRecoveryTrigger,
      });
      if (blockedRecoveryApplication.applied) {
        recoveryReason = blockedRecoveryApplication.recoveryReason;
      }

      const inspectMovement = resolveQaWalkInspectMovement({
        elapsedSeconds: elapsed,
        inspectUntil: qaWalkInspectUntil.current,
        inspectYaw: qaWalkInspectYaw.current,
      });
      const inspectMovementApplication = applyQaWalkInspectMovementFrame({
        current: {
          forwardAmount,
          mode,
          sprint,
          strafeAmount,
          targetYaw,
        },
        frame: inspectMovement,
      });
      if (inspectMovementApplication.applied) {
        mode = inspectMovementApplication.mode;
        targetYaw = inspectMovementApplication.targetYaw;
        forwardAmount = inspectMovementApplication.forwardAmount;
        strafeAmount = inspectMovementApplication.strafeAmount;
        sprint = inspectMovementApplication.sprint;
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
        const recoveryRescuePlan = resolveQaWalkRecoveryRescuePlan({
          baseRoadRescuePosition: roadRescuePosition,
          currentPosition: pos,
          darrelDragonWorldPosition: DARREL_DRAGON_WORLD_POSITION,
          darrelGroveRescuePosition: darrelRescuePosition,
          darrelRouteAssistPosition,
          elapsedSeconds: elapsed,
          lastUnstickNudgeAt: qaWalkLastUnstickNudgeAt.current,
          targetYaw,
        });
        const recoveryPlacementRefs = {
          lastUnstickNudgeAt: qaWalkLastUnstickNudgeAt,
          recoveryStartPos: qaWalkRecoveryStartPos,
          recoveryStartedAt: qaWalkRecoveryStartedAt,
          recoveryUntil: qaWalkRecoveryUntil,
          recoveryYaw: qaWalkRecoveryYaw,
        };
        const recoveryPlacementPublishers = {
          publishLocalPlayerPosition,
          publishQaPlayerPosition,
          setForwardQaWaypoint,
        };
        if (recoveryRescuePlan) {
          const placement = applyQaWalkRecoveryPlacementPlan({
            body: rigidBody.current,
            camera,
            cameraHeight: PLAYER_CAMERA_HEIGHT,
            elapsedSeconds: elapsed,
            plan: recoveryRescuePlan,
            publishers: recoveryPlacementPublishers,
            refs: recoveryPlacementRefs,
          });
          targetYaw = placement.targetYaw;
          forwardAmount = placement.forwardAmount;
          strafeAmount = placement.strafeAmount;
          recoveryReason = placement.recoveryReason;
        } else if (shouldResolveQaWalkUnstickNudgePlan({
          elapsedSeconds: elapsed,
          lastUnstickNudgeAt: qaWalkLastUnstickNudgeAt.current,
          recoveryAge,
          recoveryDistanceSq,
          stuckStrikes: qaWalkStuckStrikes.current,
        })) {
          const escape = findEscapeYaw((qaWalkYaw.current ?? currentYaw) + Math.PI, desiredYaw);
          const unstickNudgePlan = resolveQaWalkUnstickNudgePlan({
            currentPosition: pos,
            elapsedSeconds: elapsed,
            escapeYaw: escape.yaw,
            stuckStrikes: qaWalkStuckStrikes.current,
          });
          const placement = applyQaWalkRecoveryPlacementPlan({
            body: rigidBody.current,
            camera,
            cameraHeight: PLAYER_CAMERA_HEIGHT,
            elapsedSeconds: elapsed,
            plan: unstickNudgePlan,
            publishers: recoveryPlacementPublishers,
            refs: recoveryPlacementRefs,
          });
          targetYaw = placement.targetYaw;
          forwardAmount = placement.forwardAmount;
          strafeAmount = placement.strafeAmount;
          recoveryReason = placement.recoveryReason;
        } else {
          const recoveryMovementFrame = resolveQaWalkRecoveryMovementFrame({
            elapsedSeconds: elapsed,
            forwardClearance,
            recoveryAge,
            recoveryDistanceSq,
            recoveryStrafe: qaWalkRecoveryStrafe.current,
            recoveryYaw: qaWalkRecoveryYaw.current,
            stuckStrikes: qaWalkStuckStrikes.current,
            targetYaw,
            yawError,
          });
          const appliedRecoveryMovement = applyQaWalkRecoveryMovementFrame({
            frame: recoveryMovementFrame,
            publishers: { setForwardQaWaypoint },
            refs: {
              recoveryUntil: qaWalkRecoveryUntil,
              stuckStrikes: qaWalkStuckStrikes,
            },
          });
          mode = appliedRecoveryMovement.mode;
          targetYaw = appliedRecoveryMovement.targetYaw;
          forwardAmount = appliedRecoveryMovement.forwardAmount;
          strafeAmount = appliedRecoveryMovement.strafeAmount;
          if (appliedRecoveryMovement.recoveryReason) {
            recoveryReason = appliedRecoveryMovement.recoveryReason;
          }
        }
        sprint = false;
        const recoveryJumpHoldUntil = resolveQaWalkRecoveryJumpHoldUntil({
          forwardClearance,
          nowSeconds: state.clock.elapsedTime,
          previousJumpHeldUntil: qaWalkJumpHeldUntil.current,
          yawError,
        });
        applyQaWalkJumpHoldUntil({
          jumpHoldUntil: recoveryJumpHoldUntil,
          refs: { jumpHeldUntil: qaWalkJumpHeldUntil },
        });
      } else {
        const avoidMovement = resolveQaWalkAvoidMovement({
          currentYaw: qaWalkYaw.current ?? currentYaw,
          elapsedSeconds: elapsed,
          forwardClearance,
          overheadClearance,
          positionX: pos.x,
          qaRouteActive,
          strafeAmount,
          targetYaw,
          viewClearance,
        });
        const avoidMovementApplication = applyQaWalkAvoidMovementFrame({
          current: {
            forwardAmount,
            mode,
            sprint,
            strafeAmount,
          },
          frame: avoidMovement,
        });
        if (avoidMovementApplication.applied) {
          mode = avoidMovementApplication.mode;
          forwardAmount = avoidMovementApplication.forwardAmount;
          strafeAmount = avoidMovementApplication.strafeAmount;
          sprint = avoidMovementApplication.sprint;
        }
      }

      if (activeIntent && mode === "travel") {
        const intentMoveTarget = getIntentMoveTarget(activeIntent);
        const intentMoveDistanceX = intentMoveTarget.x - pos.x;
        const intentMoveDistanceZ = intentMoveTarget.z - pos.z;
        const intentMoveDistance = Math.sqrt(intentMoveDistanceX * intentMoveDistanceX + intentMoveDistanceZ * intentMoveDistanceZ);
        const activeIntentMovement = resolveQaWalkActiveIntentMovement({
          activeIntent,
          activeIntentDistance,
          completionDistance: intentCompletionDistance(activeIntent),
          currentYaw: qaWalkYaw.current ?? currentYaw,
          elapsedSeconds: elapsed,
          forwardClearance,
          intentMoveDistance,
          intentMoveTarget,
          position: pos,
          qaSpellDummyRunActive,
          strafeAmount,
        });
        const activeIntentMovementApplication = applyQaWalkActiveIntentMovementFrame({
          frame: activeIntentMovement,
        });
        targetYaw = activeIntentMovementApplication.targetYaw;
        mode = activeIntentMovementApplication.mode;
        forwardAmount = activeIntentMovementApplication.forwardAmount;
        strafeAmount = activeIntentMovementApplication.strafeAmount;
        sprint = activeIntentMovementApplication.sprint;
        const intentJumpHoldUntil = resolveQaWalkIntentJumpHoldUntil({
          activeIntentDistance,
          activeIntentKind: activeIntent.kind,
          intentMoveDistance,
          nowSeconds: state.clock.elapsedTime,
          planarSpeedSq: velocity.x * velocity.x + velocity.z * velocity.z,
          previousJumpHeldUntil: qaWalkJumpHeldUntil.current,
        });
        applyQaWalkJumpHoldUntil({
          jumpHoldUntil: intentJumpHoldUntil,
          refs: { jumpHeldUntil: qaWalkJumpHeldUntil },
        });
        const interactionAction = resolveQaWalkIntentInteractionAction({
          activeIntent,
          activeIntentDistance,
          completionDistance: intentCompletionDistance(activeIntent),
          elapsedSeconds: elapsed,
          lastInteractionAt: qaWalkLastInteractionAt.current,
        });
        applyQaWalkIntentInteractionAction({
          action: interactionAction,
          elapsedSeconds: elapsed,
          publishers: {
            dispatchQuestVillagerInteraction,
            publishSurvivalWalkAction,
          },
          refs: { lastInteractionAt: qaWalkLastInteractionAt },
        });
        const collectionAction = resolveQaWalkManaFlowerCollectionAction({
          activeIntent,
          collected: activeIntent.kind === "mana-flower" && wasSurvivalWalkManaFlowerCollected(activeIntent.id),
          elapsedSeconds: elapsed,
        });
        applyQaWalkManaFlowerCollectionAction({
          action: collectionAction,
          publishers: { publishSurvivalWalkAction },
          refs: {
            intent: qaWalkIntent,
            nextIntentAt: qaWalkNextIntentAt,
          },
        });
      }

      const scheduleNextCombatCast = (minimumSeconds = QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL) => {
        qaWalkNextCombatCastAt.current = getQaWalkNextCombatCastAt({
          elapsedSeconds: elapsed,
          x: pos.x,
          z: pos.z,
          combatSpellIndex: qaWalkCombatSpellIndex.current,
          minimumSeconds,
          qaSpellDummyRunActive,
        });
      };

      const scheduleNextPracticeCast = (minimumSeconds = QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL) => {
        qaWalkNextPracticeCastAt.current = getQaWalkNextPracticeCastAt({
          elapsedSeconds: elapsed,
          x: pos.x,
          z: pos.z,
          practiceSpellIndex: qaWalkPracticeSpellIndex.current,
          minimumSeconds,
        });
      };

      const castQaPracticeSpell = (spell: SpellType) => {
        const dir = spellDirection;
        camera.getWorldDirection(dir);
        if (dir.lengthSq() < 0.001) dir.set(0, 0, -1);
        dir.normalize();

        const hand = getQaWalkPracticeCastHand(qaWalkPracticeSpellIndex.current);
        const { spawnPos } = getPlayerSpellLaunchInto(hand, camera, dir, spellLaunchScratch);
        const flatDir = spellFlatDirection.set(dir.x, 0, dir.z);
        if (flatDir.lengthSq() < 0.001) flatDir.set(0, 0, -1);
        flatDir.normalize();
        const projectilePos = resolveQaWalkPracticeProjectilePosition({
          spell,
          playerPos: pos,
          spawnPos,
          flatDir,
          footOffset: PLAYER_FOOT_OFFSET,
        });
        const store = useGameStore.getState();
        applyQaWalkPracticeCast({
          addProjectile: store.addProjectile,
          createdAt: nowMs,
          creatorId: getLocalNetworkPlayerId(),
          dir: { x: dir.x, y: dir.y, z: dir.z },
          emitGameNetworkEvent,
          hand,
          pos: projectilePos,
          publishPracticeCast: publishSurvivalWalkPracticeCast,
          pulseHandCharging: (targetHand, chargeMs) => {
            pulsePlayerHandCharging(targetHand, chargeMs, {
              setHandCharging: (chargingHand, charging) => useGameStore.getState().setHandCharging(chargingHand, charging),
              setTimeout: (handler, timeoutMs) => window.setTimeout(handler, timeoutMs),
            });
          },
          spell,
        });
      };

      if (qaWalkNextCombatCastAt.current <= 0) {
        scheduleNextCombatCast(QA_SURVIVAL_COMBAT_CAST_MIN_INTERVAL * 0.55);
      }
      if (qaWalkNextPracticeCastAt.current <= 0) {
        scheduleNextPracticeCast(QA_SURVIVAL_PRACTICE_CAST_MIN_INTERVAL * 0.45);
      }

      const spellDummies = readQaSpellDummiesScratch();
      const spellDummyTargets = resolveQaWalkSpellDummyTargets({
        spellDummies,
        playerPosition: pos,
        activeIntent,
        activeIntentDistance,
        qaSpellDummyRunActive,
      });
      const combatSpellDummy = spellDummyTargets.combatSpellDummy;
      const qaSpellDummyHits = getSurvivalWalkSpellDummyHitCount();

      const shouldReanchorSpellDummy = shouldReanchorQaWalkSpellDummy({
        activeDummyTooFar: spellDummyTargets.activeDummyTooFar,
        elapsedSeconds: elapsed,
        lastDummyReanchorAt: qaWalkLastDummyReanchorAt.current,
        mode,
        nearestAnySpellDummy: spellDummyTargets.nearestAnySpellDummy,
        nearestAnySpellDummyDistanceSq: spellDummyTargets.nearestAnySpellDummyDistanceSq,
        qaSpellDummyHits,
        qaSpellDummyRunActive,
      });
      const reanchorPlan = shouldReanchorSpellDummy
        ? resolveQaWalkSpellDummyReanchorPlan({
            currentYaw: qaWalkYaw.current ?? currentYaw,
            elapsedSeconds: elapsed,
            mode,
            nearestAnySpellDummyDistanceSq: spellDummyTargets.nearestAnySpellDummyDistanceSq,
            nextCombatCastAt: qaWalkNextCombatCastAt.current,
            playerPosition: pos,
            qaSpellDummyHits,
            recoveryYaw: qaWalkRecoveryYaw.current,
          })
        : null;
      applyQaWalkSpellDummyReanchorPlan({
        elapsedSeconds: elapsed,
        plan: reanchorPlan,
        publishers: {
          dispatchQaSpellDummySpawn,
          publishSurvivalWalkAction,
        },
        refs: {
          intent: qaWalkIntent,
          lastDummyReanchorAt: qaWalkLastDummyReanchorAt,
          nextCombatCastAt: qaWalkNextCombatCastAt,
          nextIntentAt: qaWalkNextIntentAt,
          stuckStrikes: qaWalkStuckStrikes,
        },
      });

      const combatCastDecision = resolveQaWalkCombatCastDecision({
        combatSpellDummy,
        combatSpellIndex: qaWalkCombatSpellIndex.current,
        elapsedSeconds: elapsed,
        lastCombatCastAt: qaWalkLastCombatCastAt.current,
        mode,
        nextCombatCastAt: qaWalkNextCombatCastAt.current,
        playerPosition: pos,
      });
      applyQaWalkCombatCastDecision({
        decision: combatCastDecision,
        elapsedSeconds: elapsed,
        publishers: {
          dispatchQaSpellCastAtDummy,
          publishSurvivalWalkAction,
          scheduleNextCombatCast,
        },
        refs: {
          combatFocusUntil: qaWalkCombatFocusUntil,
          combatSpellIndex: qaWalkCombatSpellIndex,
          combatTargetYaw: qaWalkCombatTargetYaw,
          lastCombatCastAt: qaWalkLastCombatCastAt,
        },
      });

      applyQaWalkSpellDummyRunMotionBrake({
        activeIntentKind: activeIntent?.kind ?? null,
        body: rigidBody.current,
        qaSpellDummyRunActive,
      });

      const practiceCastDecision = resolveQaWalkPracticeCastDecision({
        activeIntentKind: activeIntent?.kind ?? null,
        combatSpellDummyActive: Boolean(combatSpellDummy),
        currentYaw: qaWalkYaw.current ?? currentYaw,
        elapsedSeconds: elapsed,
        forwardClearance,
        mode,
        nextPracticeCastAt: qaWalkNextPracticeCastAt.current,
        practiceSpellIndex: qaWalkPracticeSpellIndex.current,
        viewClearance,
      });
      applyQaWalkPracticeCastDecision({
        decision: practiceCastDecision,
        publishers: {
          castQaPracticeSpell,
          scheduleNextPracticeCast,
        },
        refs: {
          combatFocusUntil: qaWalkCombatFocusUntil,
          combatTargetYaw: qaWalkCombatTargetYaw,
          practiceSpellIndex: qaWalkPracticeSpellIndex,
        },
      });

      const combatFocusMovement = resolveQaWalkCombatFocusMovement({
        activeIntentKind: activeIntent?.kind ?? null,
        combatFocusActive: Boolean(combatSpellDummy),
        combatFocusUntil: qaWalkCombatFocusUntil.current,
        combatTargetYaw: qaWalkCombatTargetYaw.current,
        elapsedSeconds: elapsed,
        mode,
        qaSpellDummyRunActive,
      });
      const combatFocusMovementApplication = applyQaWalkCombatFocusMovementFrame({
        current: {
          forwardAmount,
          mode,
          sprint,
          strafeAmount,
          targetYaw,
        },
        frame: combatFocusMovement,
      });
      if (combatFocusMovementApplication.applied) {
        mode = combatFocusMovementApplication.mode;
        targetYaw = combatFocusMovementApplication.targetYaw;
        forwardAmount = combatFocusMovementApplication.forwardAmount;
        strafeAmount = combatFocusMovementApplication.strafeAmount;
        sprint = combatFocusMovementApplication.sprint;
      } else {
        const throttle = resolveQaWalkClearanceThrottle({
          forwardAmount,
          forwardClearance,
          forwardLookAhead,
          mode,
          overheadClearance,
          sprint,
          viewClearance,
        });
        const throttleApplication = applyQaWalkClearanceThrottle({ throttle });
        forwardAmount = throttleApplication.forwardAmount;
        sprint = throttleApplication.sprint;
      }

      const planarSpeedSq = velocity.x * velocity.x + velocity.z * velocity.z;
      const planarSpeed = Math.sqrt(planarSpeedSq);
      const lowSpeedRecovery = resolveQaWalkLowSpeedRecovery({
        elapsedSeconds: elapsed,
        forwardAmount,
        lilyCoilTubeQaActive,
        lowSpeedStartedAt: qaWalkLowSpeedStartedAt.current,
        mode,
        planarSpeedSq,
        stuckStrikes: qaWalkStuckStrikes.current,
      });
      const lowSpeedRecoveryApplication = applyQaWalkLowSpeedRecovery({
        beginRecovery: beginQaWalkRecovery,
        recovery: lowSpeedRecovery,
        refs: {
          lowSpeedStartedAt: qaWalkLowSpeedStartedAt,
          recoveryYaw: qaWalkRecoveryYaw,
          stuckStrikes: qaWalkStuckStrikes,
        },
      });
      const expectingMovement = lowSpeedRecoveryApplication.expectingMovement;
      if (lowSpeedRecoveryApplication.recovered) {
        mode = lowSpeedRecoveryApplication.mode;
        recoveryReason = lowSpeedRecoveryApplication.recoveryReason;
        targetYaw = lowSpeedRecoveryApplication.targetYaw;
        strafeAmount = lowSpeedRecoveryApplication.strafeAmount;
        forwardAmount = lowSpeedRecoveryApplication.forwardAmount;
        sprint = lowSpeedRecoveryApplication.sprint;
      }

      const progressRecovery = resolveQaWalkProgressRecovery({
        elapsedSeconds: elapsed,
        forwardClearance,
        lastProgressAt: qaWalkLastProgressAt.current,
        lastProgressPosition: qaWalkLastProgressPos.current,
        lilyCoilTubeQaActive,
        mode,
        planarSpeedSq,
        position: pos,
        qaRouteActive,
        stuckStrikes: qaWalkStuckStrikes.current,
        waypoint: qaWalkWaypoint.current,
        waypointDistance,
      });
      const progressRecoveryApplication = applyQaWalkProgressRecovery({
        beginRecovery: beginQaWalkRecovery,
        currentYaw: qaWalkYaw.current ?? currentYaw,
        elapsedSeconds: elapsed,
        position: pos,
        progress: progressRecovery,
        publishers: { setForwardQaWaypoint },
        refs: {
          lastProgressAt: qaWalkLastProgressAt,
          lastProgressPosition: qaWalkLastProgressPos,
          recoveryYaw: qaWalkRecoveryYaw,
          stuckStrikes: qaWalkStuckStrikes,
        },
      });
      if (progressRecoveryApplication.recovered) {
        mode = progressRecoveryApplication.mode;
        recoveryReason = progressRecoveryApplication.recoveryReason;
        targetYaw = progressRecoveryApplication.targetYaw;
        strafeAmount = progressRecoveryApplication.strafeAmount;
        forwardAmount = progressRecoveryApplication.forwardAmount;
        sprint = progressRecoveryApplication.sprint;
      }

      const lookInputFrame = resolveQaWalkLookInputFrame({
        currentYaw: qaWalkYaw.current,
        deltaSeconds: delta,
        elapsedSeconds: elapsed,
        forwardAmount,
        lilyCoilTubeQaActive,
        mode,
        sprint,
        strafeAmount,
        targetInput: qaWalkInputState.current,
        targetYaw,
      });
      const yaw = lookInputFrame.yaw;
      qaWalkYaw.current = yaw;
      controllerLookEuler.current.set(lookInputFrame.pitch, lookInputFrame.cameraYaw, 0);
      camera.quaternion.setFromEuler(controllerLookEuler.current);

      const inputMode = lookInputFrame.input.mode;
      const movingInOpenLane = isQaWalkMovingInOpenLane({
        forwardClearance,
        forwardLookAhead,
        lilyCoilTubeQaActive,
        planarSpeedSq,
        viewClearance,
      });
      const openLaneRelief = resolveQaWalkOpenLaneRecoveryRelief({
        elapsedSeconds: elapsed,
        mode,
        movingInOpenLane,
        recoveryUntil: qaWalkRecoveryUntil.current,
        stuckStrikes: qaWalkStuckStrikes.current,
      });
      applyQaWalkOpenLaneRecoveryRelief({
        refs: {
          recoveryUntil: qaWalkRecoveryUntil,
          stuckStrikes: qaWalkStuckStrikes,
        },
        relief: openLaneRelief,
      });
      const telemetryMovement = resolveQaWalkTelemetryMovement({
        elapsedSeconds: elapsed,
        lastTelemetryAt: qaWalkLastTelemetryAt.current,
        lastTelemetryPosition: qaWalkLastTelemetryPos.current,
        planarSpeed,
        position: pos,
      });
      qaWalkLastTelemetryAt.current = elapsed;
      qaWalkLastTelemetryPos.current.set(pos.x, pos.y, pos.z);
      const activeRouteWaypoint = qaRouteActive
        ? qaRouteWaypoints[qaWalkRouteIndex.current % qaRouteWaypoints.length]
        : null;
      const abnormality = resolveQaWalkTelemetryAbnormality({
        expectingMovement,
        forwardClearance,
        lilyCoilTubeQaActive,
        movingInOpenLane,
        overheadClearance,
        planarSpeedSq,
        positionJumpAbnormality: telemetryMovement.positionJumpAbnormality,
        recoveryReason,
        stuckStrikes: qaWalkStuckStrikes.current,
        telemetryMoveSq: telemetryMovement.moveSq,
        viewClearance,
      });
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
          mana: readReadyQaManaFlowersScratch().length,
          dummies: spellDummies.length,
          quests: questIntentTargets.length,
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
      applyPlayerModalBlockedMovementFrame({
        body: rigidBody.current,
        crouchHoldStartedAt,
        currentVelocityY: velocity.y,
        dispatchStationaryPlayerState: () => {
          dispatchStationaryPlayerState(lastDispatchedPlayerStateRef.current, { isGrounded: true });
        },
        isCrouching,
        setIsCrouching,
        vclipActive,
      });
      return;
    }

    const chargingHands = storeState.chargingHands;
    const healSpellFrameApplier = {
      clearToxicEffects: clearToxicEffectsWithNetwork,
      setHealth: useGameStore.getState().setHealth,
    };

    for (let handIndex = 0; handIndex < PLAYER_CASTING_HANDS.length; handIndex += 1) {
      const hand = PLAYER_CASTING_HANDS[handIndex];
      const handSpell = getPlayerSpellForHand(storeState, hand);
      const runeReady = hasPlayerRunePowerForHand(storeState, hand);

      if (
        resetPlayerCastingHandFrameGate({
          activeCastingHands,
          chargingHands,
          flamethrowerTimers,
          hand,
          isMagicArmed: storeState.isMagicArmed,
          runeReady,
          setHandCharging: useGameStore.getState().setHandCharging,
        })
      ) {
        continue;
      }

      const healFrame = applyPlayerHealSpellFrame({
        applier: healSpellFrameApplier,
        charging: chargingHands[hand],
        deltaSeconds: delta,
        health,
        spell: handSpell,
      });
      health = healFrame.health;

      if (handSpell === 'flamethrower' && chargingHands[hand] && gameplayInputActive) {
        if (!consumePlayerHandFrameTimer(flamethrowerTimers, hand, delta, 0.05)) continue;
        const dir = spellDirection;
        camera.getWorldDirection(dir);
        const lateral = spellLateral.crossVectors(camera.up, dir).normalize();
        
        applyFlamethrowerSpreadInto(dir);

        const { spawnPos } = getPlayerSpellLaunchInto(hand, camera, dir, spellLaunchScratch, true, lateral);

        applyPlayerSpellProjectileNetworkCast({
          addProjectile: useGameStore.getState().addProjectile,
          createdAt: nowMs,
          creatorId: getLocalNetworkPlayerId(),
          dir: { x: dir.x, y: dir.y, z: dir.z },
          emitGameNetworkEvent,
          hand,
          pos: { x: spawnPos.x, y: spawnPos.y, z: spawnPos.z },
          type: 'flamethrower',
        });
      }
    }

    // Calculate robust yaw angle
    camera.getWorldDirection(frameForward);
    const yaw = Math.atan2(frameForward.x, -frameForward.z);
    publishLastPlayerYaw(yaw);

    if (sleepActive) {
      resetPlayerSlideAndCrouchState({
        crouchHoldStartedAt,
        isCrouching,
        isSliding,
        setIsCrouching,
        setIsSliding,
      });
      resetPlayerCastingHandsRuntime({
        activeCastingHands,
        chargingHands: storeState.chargingHands,
        flamethrowerTimers,
        hands: PLAYER_CASTING_HANDS,
        setHandCharging: useGameStore.getState().setHandCharging,
      });
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

      const tubeSlideFrame = applyPlayerLilyCoilTubeSlideFrame({
        delta,
        hasPlanarMovementInput,
        isSliding,
        lastSlideTime,
        nowMs,
        setIsSliding,
        slideInputHeld,
        slideRestartCooldownMs: SLIDE_RESTART_COOLDOWN_MS,
        slideTimer,
        tubeJumpOffset: tubeState.jumpOffset,
        tubeJumpVelocity: tubeState.jumpVelocity,
      });
      const { tubeSlideHeld, tubeSliding } = tubeSlideFrame;

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
      const tubeThrusterState = useGameStore.getState();
      const tubeJumpFrame = applyPlayerLilyCoilTubeJumpThrusterFrame({
        currentFuel: tubeThrusterState.thrusterFuel,
        delta,
        jumpBoostActive,
        jumpBoostMultiplier: JUMP_BOOST_MULTIPLIER,
        jumpForce: LILY_COIL_TUBE_JUMP_FORCE,
        jumpGravity: LILY_COIL_TUBE_JUMP_GRAVITY,
        jumpHeld,
        jumpRequested,
        maxJumpOffset: LILY_COIL_TUBE_MAX_JUMP_OFFSET,
        setJumps,
        setThrusterFuel: tubeThrusterState.setThrusterFuel,
        thrusterFuelDrainPerSecond: 0.8,
        thrusterFuelRechargePerSecond: 0.4,
        thrusterImpulsePerSecond: 35,
        thrusterLocked,
        tubeState,
      });
      const tubeAirborne = tubeJumpFrame.tubeAirborne;
      tubeBodyPosition
        .copy(frame.center)
        .addScaledVector(radial, LILY_COIL_TUBE_PLAYER_RADIUS)
        .addScaledVector(playerUp, tubeState.jumpOffset);
      const tubeCameraHeight = getPlayerCameraHeight(tubeSliding, isCrouching);
      tubeCameraPosition.copy(tubeBodyPosition).addScaledVector(playerUp, tubeCameraHeight);
      tubeForward.copy(frame.tangent).multiplyScalar(forwardInput < -0.1 ? -1 : 1).normalize();

      applyPlayerLilyCoilTubePlacementFrame({
        aroundSurface,
        body: rigidBody.current,
        bodyPosition: tubeBodyPosition,
        camera,
        cameraPosition: tubeCameraPosition,
        controllerLookEuler: controllerLookEuler.current,
        elapsedSeconds: state.clock.elapsedTime,
        frameTangent: frame.tangent,
        playerUp,
        qaTubeAutoPilot,
        shouldAlignTubeView,
        tubeForward,
        tubeLookDirection,
        tubePathInput,
        tubeState,
        tubeSurfaceInput,
        tubeUpRotation,
      });
      if (!tubeAirborne) setJumps(0);
      resetPlayerCrouchState({ crouchHoldStartedAt, isCrouching, setIsCrouching });

      camera.getWorldDirection(frameForward);
      const tubeYaw = Math.atan2(frameForward.x, -frameForward.z);
      publishLastPlayerYaw(tubeYaw);
      publishLocalPlayerPosition(tubeBodyPosition, { rememberLast: true });
      publishPlayerLilyCoilTubeState({
        t: tubeState.t,
        surfaceAngle: tubeState.surfaceAngle,
      });

      const tubeMoving = isPlayerLilyCoilTubeMoving({
        forwardInput,
        hasMovementInput,
        tubeSurfaceInput,
      });
      const tubeDispatchState = getPlayerLilyCoilTubeDispatchState({
        isSprinting,
        tubeAirborne,
        tubeMoving,
        tubeSliding,
      });
      dispatchPlayerLilyCoilTubeMovementFrame({
        isGrounded: tubeDispatchState.grounded,
        isMoving: tubeDispatchState.moving,
        isSliding: tubeDispatchState.sliding,
        isSprinting: tubeDispatchState.sprinting,
        position: tubeBodyPosition,
        snapshot: lastDispatchedPlayerStateRef.current,
        yaw: tubeYaw,
      });
      if (isNavigationRecordingActive()) {
        recordNavigationSample(createPlayerLilyCoilTubeNavigationSampleInput({
          aimDirection: frameForward,
          aroundSurface,
          cameraRotationX: camera.rotation.x,
          cameraRotationZ: camera.rotation.z,
          forwardInput,
          gameMode: storeState.gameMode,
          isSprinting,
          jumpHeld,
          playerPosition: tubeBodyPosition,
          playerUp,
          spellMenuOpen: storeState.isSpellMenuOpen,
          tubeAirborne,
          tubeJumpVelocity: tubeState.jumpVelocity,
          tubeMoveSpeed,
          tubeMoving,
          tubePathInput,
          tubeSlideHeld,
          tubeSliding,
          tubeStrafeInput,
          tubeSurfaceInput,
          tubeTangent: frame.tangent,
          yaw: tubeYaw,
        }), nowMs);
      }

      const tubeNetworkFrame = resolvePlayerLilyCoilTubeNetworkFrame({
        isSprinting,
        lastNetworkSync,
        networkSyncIntervalMs: 1000 / 15,
        nowMs,
        tubeAirborne,
        tubeMoving,
        tubeSliding,
      });
      emitPlayerNetworkPoseSyncIfDue({
        aimDir: frameForward,
        anim: tubeNetworkFrame.anim,
        camera,
        characterCustomization: storeState.characterCustomization,
        isVoiceSpeaking: storeState.isVoiceSpeaking,
        pos: { x: tubeBodyPosition.x, y: tubeBodyPosition.y, z: tubeBodyPosition.z },
        shouldSyncNetwork: tubeNetworkFrame.shouldSyncNetwork,
        survivalLevel: storeState.survivalLevel,
        yaw: tubeYaw,
      });
      return;
    }

    const staleLilyCoilRoll = hasCameraRollAgainstWorldUp();
    if (lilyCoilTubeState.current.active || staleLilyCoilRoll) {
      resetLilyCoilCameraState();
    }

    applyPlayerPlanarMovementDirectionFrame({
      cameraRotation: camera.rotation,
      currentSpeed,
      direction,
      hasPlanarMovementInput,
    });

    const movementModifierFrame = applyPlayerMovementModifierFrame({
      direction,
      isSliding,
      isSprinting,
      ladderActive,
      ladderPlanarDamping: 0.22,
      ladderVerticalInput,
      pullFrames,
      pullVelocity,
      setIsSliding,
      vclipActive,
      vclipSprintMultiplier: VCLIP_SPRINT_MULTIPLIER,
      vclipVerticalSpeed: VCLIP_VERTICAL_SPEED,
      velocity,
      verticalInput,
    });
    const hasActiveExternalPull = movementModifierFrame.hasActiveExternalPull;
    
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

    updatePlayerCrouchHoldState({
      crouchAllowed,
      crouchHoldMs: CROUCH_HOLD_MS,
      crouchHoldStartedAt,
      isCrouching,
      nowMs,
      setIsCrouching,
    });

    const floorRecoveryGate = resolvePlayerFloorRecoveryGate({
      climbingLadder,
      grabbedActive: Boolean(grabbedState.current),
      hasGroundHit,
      jumpHeld,
      posY: pos.y,
      survivalModeActive,
      vclipActive,
      velocityY: velocity.y,
    });
    if (floorRecoveryGate.shouldRecover) {
      const recoveryTarget = getPlayerFloorRecoveryTarget({
        pos,
        world,
        rapier,
        queryOptions: playerQueryOptions,
        includeDeepRecovery: floorRecoveryGate.includeDeepRecovery,
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
    
    dispatchPlayerMovementFrame({
      isCrouching,
      isGrounded: effectiveGrounded,
      isMeditating: false,
      isMoving: hasMovementInput,
      isSliding,
      isSprinting,
      position: pos,
      snapshot: lastDispatchedPlayerStateRef.current,
      yaw,
    });

    if (isNavigationRecordingActive()) {
      camera.getWorldDirection(navigationAimDirection);
      recordNavigationSample(createPlayerNavigationSampleInput({
        aimDirection: navigationAimDirection,
        bodyVelocityY: velocity.y,
        cameraRotationX: camera.rotation.x,
        cameraRotationZ: camera.rotation.z,
        effectiveGrounded,
        forwardInput,
        gameMode: storeState.gameMode,
        hasMovementInput,
        isSliding,
        isSprinting,
        jumpHeld,
        movementVelocity: direction,
        playerPosition: pos,
        slideHeld,
        spellMenuOpen: storeState.isSpellMenuOpen,
        strafeInput,
        vclipActive,
        yaw,
      }), nowMs);
    }

    applyPlayerGroundSlideFrame({
      delta,
      effectiveGrounded,
      hasPlanarMovementInput,
      isSliding,
      lastSlideTime,
      nowMs,
      planarVelocityX: velocity.x,
      planarVelocityZ: velocity.z,
      resetJumps: () => setJumps(0),
      setIsSliding,
      slideHeld,
      slideRestartCooldownMs: SLIDE_RESTART_COOLDOWN_MS,
      slideStartMinSpeedSq: SLIDE_START_MIN_SPEED_SQ,
      slideTimer,
      vclipActive,
    });

    applyPlayerMovementVelocityFrame({
      body: rigidBody.current,
      climbingLadder,
      directionX: direction.x,
      directionY: direction.y,
      directionZ: direction.z,
      idleGroundedPlanarLock,
      ladderClimbSpeed: LADDER_CLIMB_SPEED,
      ladderIdleHoldSpeed: LADDER_IDLE_HOLD_SPEED,
      ladderVerticalInput,
      vclipActive,
      velocityY: velocity.y,
    });

    const thrusterState = useGameStore.getState();
    applyPlayerJumpThrusterFrame({
      body: rigidBody.current,
      climbingLadder,
      currentFuel: thrusterState.thrusterFuel,
      delta,
      effectiveGrounded,
      groundJumpMaxUpwardVelocity: GROUND_JUMP_MAX_UPWARD_VELOCITY,
      grounded,
      idleGroundedPlanarLock,
      jumpBoostActive,
      jumpBoostMultiplier: JUMP_BOOST_MULTIPLIER,
      jumpForce: JUMP_FORCE,
      jumpHeld,
      jumpRequested,
      planarVelocityX: velocity.x,
      planarVelocityZ: velocity.z,
      setJumps,
      setThrusterFuel: thrusterState.setThrusterFuel,
      sleepActive,
      thrusterFuelDrainPerSecond: 0.8,
      thrusterFuelRechargePerSecond: 0.4,
      thrusterImpulsePerSecond: 35,
      thrusterLocked,
      vclipActive,
      velocityY: velocity.y,
    });

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
    applyPlayerFallRecovery({
      body: rigidBody.current,
      camera,
      cameraHeight: PLAYER_CAMERA_HEIGHT,
      getSpawnPosition: () => getPlayerSpawnPosition(DEFAULT_FALL_RECOVERY_SPAWN_POSITION),
      posY: pos.y,
      vclipActive,
    });

    // Sync network
    const networkSyncFrame = resolvePlayerNetworkSyncFrame({
      activeGrabIds: activeGrabIds.current,
      lastNetworkSync,
      nowMs,
    });
    emitPlayerNetworkSyncIfDue({
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
      shouldSyncNetwork: networkSyncFrame.shouldSyncNetwork,
      sleepActive,
      survivalLevel: storeState.survivalLevel,
      velocityY: velocity.y,
      yaw,
    });
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
