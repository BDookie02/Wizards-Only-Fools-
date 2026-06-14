import type { HandType } from "../../../store/gameStore";

export type PlayerMouseCastAction =
  | { type: "none" }
  | { type: "prevent-default" }
  | {
      type: "start";
      hand: HandType;
    };

export type PlayerMouseReleaseAction =
  | { type: "none" }
  | {
      type: "release";
      hand: HandType;
    };

export type PlayerContextMenuAction =
  | { type: "none" }
  | { type: "prevent-default" };

type PlayerMouseCastOptions = {
  gameplayInputAllowed: boolean;
  questInteractionHandled: boolean;
  surfaceBlocked: boolean;
};

function getMouseButtonHand(button: number): HandType | null {
  if (button === 0) return "left";
  if (button === 2) return "right";
  return null;
}

export function isPlayerMouseCastButton(button: number) {
  return getMouseButtonHand(button) !== null;
}

export function resolvePlayerMouseCastAction(
  button: number,
  options: PlayerMouseCastOptions,
): PlayerMouseCastAction {
  if (options.surfaceBlocked) return { type: "none" };

  const hand = getMouseButtonHand(button);
  if (!hand) return { type: "none" };

  if (options.gameplayInputAllowed && options.questInteractionHandled) {
    return { type: "prevent-default" };
  }

  return { type: "start", hand };
}

export function resolvePlayerMouseReleaseAction(
  button: number,
  surfaceBlocked: boolean,
): PlayerMouseReleaseAction {
  if (surfaceBlocked) return { type: "none" };

  const hand = getMouseButtonHand(button);
  return hand ? { type: "release", hand } : { type: "none" };
}

export function resolvePlayerContextMenuAction(
  gameplayInputAllowed: boolean,
): PlayerContextMenuAction {
  return gameplayInputAllowed ? { type: "prevent-default" } : { type: "none" };
}
