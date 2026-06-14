import {
  isGamepadButtonPressed,
  readGamepadStickAxesInto,
  type GamepadButtonName,
  type GamepadStickAxes,
} from "../../systems/input/controllerInput";

export type HudControllerBindings = {
  leftHotbar: string;
  rightHotbar: string;
  menuSelect: string;
  menuBack: string;
  inventory: string;
  spellMenu: string;
  interact: string;
  map: string;
  scoreboard: string;
  pause: string;
};

export type HudControllerInputSnapshot = {
  leftBumperHeld: boolean;
  rightBumperHeld: boolean;
  hotbarModifierHeld: boolean;
  leftBumperPressed: boolean;
  rightBumperPressed: boolean;
  aPressed: boolean;
  bPressed: boolean;
  inventoryHeld: boolean;
  inventoryPressed: boolean;
  spellMenuHeld: boolean;
  spellMenuPressed: boolean;
  interactHeld: boolean;
  yPressed: boolean;
  backHeld: boolean;
  startPressed: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  movementAxisX: number;
  movementAxisY: number;
  menuAxisX: number;
  menuAxisY: number;
  scrollAxisY: number;
};

const hudLeftStickScratch: GamepadStickAxes = { x: 0, y: 0 };
const hudRightStickScratch: GamepadStickAxes = { x: 0, y: 0 };

function readBoundControllerButton(gamepad: Gamepad, button: string) {
  return isGamepadButtonPressed(gamepad, button as GamepadButtonName);
}

export function createHudControllerInputSnapshot(): HudControllerInputSnapshot {
  return {
    leftBumperHeld: false,
    rightBumperHeld: false,
    hotbarModifierHeld: false,
    leftBumperPressed: false,
    rightBumperPressed: false,
    aPressed: false,
    bPressed: false,
    inventoryHeld: false,
    inventoryPressed: false,
    spellMenuHeld: false,
    spellMenuPressed: false,
    interactHeld: false,
    yPressed: false,
    backHeld: false,
    startPressed: false,
    dpadLeft: false,
    dpadRight: false,
    dpadUp: false,
    dpadDown: false,
    movementAxisX: 0,
    movementAxisY: 0,
    menuAxisX: 0,
    menuAxisY: 0,
    scrollAxisY: 0,
  };
}

export function readHudControllerInputSnapshotInto(
  gamepad: Gamepad,
  bindings: HudControllerBindings,
  consumePress: (key: string, pressed: boolean) => boolean,
  target: HudControllerInputSnapshot,
): HudControllerInputSnapshot {
  const leftBumperHeld = readBoundControllerButton(gamepad, bindings.leftHotbar);
  const rightBumperHeld = readBoundControllerButton(gamepad, bindings.rightHotbar);
  const inventoryHeld = readBoundControllerButton(gamepad, bindings.inventory);
  const spellMenuHeld = readBoundControllerButton(gamepad, bindings.spellMenu);

  target.leftBumperHeld = leftBumperHeld;
  target.rightBumperHeld = rightBumperHeld;
  target.hotbarModifierHeld = leftBumperHeld || rightBumperHeld;
  target.leftBumperPressed = consumePress("leftBumper", leftBumperHeld);
  target.rightBumperPressed = consumePress("rightBumper", rightBumperHeld);
  target.aPressed = consumePress("a", readBoundControllerButton(gamepad, bindings.menuSelect));
  target.bPressed = consumePress("b", readBoundControllerButton(gamepad, bindings.menuBack));
  target.inventoryHeld = inventoryHeld;
  target.inventoryPressed = consumePress("inventory", inventoryHeld);
  target.spellMenuHeld = spellMenuHeld;
  target.spellMenuPressed = consumePress("spellMenu", spellMenuHeld);
  target.interactHeld = readBoundControllerButton(gamepad, bindings.interact);
  target.yPressed = consumePress("y", readBoundControllerButton(gamepad, bindings.map));
  target.backHeld = readBoundControllerButton(gamepad, bindings.scoreboard);
  target.startPressed = consumePress("start", readBoundControllerButton(gamepad, bindings.pause));
  target.dpadLeft = isGamepadButtonPressed(gamepad, "dpadLeft");
  target.dpadRight = isGamepadButtonPressed(gamepad, "dpadRight");
  target.dpadUp = isGamepadButtonPressed(gamepad, "dpadUp");
  target.dpadDown = isGamepadButtonPressed(gamepad, "dpadDown");
  readGamepadStickAxesInto(gamepad, "left", hudLeftStickScratch, 0.25);
  target.movementAxisX = hudLeftStickScratch.x;
  target.movementAxisY = hudLeftStickScratch.y;
  readGamepadStickAxesInto(gamepad, "left", hudLeftStickScratch, 0.55);
  target.menuAxisX = hudLeftStickScratch.x;
  target.menuAxisY = hudLeftStickScratch.y;
  readGamepadStickAxesInto(gamepad, "right", hudRightStickScratch, 0.25);
  target.scrollAxisY = hudRightStickScratch.y;
  return target;
}

export function readHudControllerInputSnapshot(
  gamepad: Gamepad,
  bindings: HudControllerBindings,
  consumePress: (key: string, pressed: boolean) => boolean,
): HudControllerInputSnapshot {
  return readHudControllerInputSnapshotInto(
    gamepad,
    bindings,
    consumePress,
    createHudControllerInputSnapshot(),
  );
}
