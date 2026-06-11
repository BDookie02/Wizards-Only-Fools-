import type { ControllerAction, ControllerButtonName } from "../../../store/gameStore";

export const controllerButtonLabels: Record<ControllerButtonName, string> = {
  a: "A",
  b: "B",
  x: "X",
  y: "Y",
  leftBumper: "LB",
  rightBumper: "RB",
  leftTrigger: "LT",
  rightTrigger: "RT",
  back: "Select",
  start: "Start",
  leftStick: "Left Stick",
  rightStick: "Right Stick",
  dpadUp: "D-Pad Up",
  dpadDown: "D-Pad Down",
  dpadLeft: "D-Pad Left",
  dpadRight: "D-Pad Right",
};

export const controllerButtonOptions: readonly ControllerButtonName[] = [
  "a",
  "b",
  "x",
  "y",
  "leftBumper",
  "rightBumper",
  "leftTrigger",
  "rightTrigger",
  "back",
  "start",
  "leftStick",
  "rightStick",
  "dpadUp",
  "dpadDown",
  "dpadLeft",
  "dpadRight",
];

export type ControllerActionSettingsRow = {
  action: ControllerAction;
  label: string;
  hint: string;
};

export const controllerActionRows: ControllerActionSettingsRow[] = [
  { action: "leftCast", label: "Left Cast", hint: "fires left hand" },
  { action: "rightCast", label: "Right Cast", hint: "fires right hand" },
  { action: "jump", label: "Jump / Thruster", hint: "jump and air boost" },
  { action: "slide", label: "Slide", hint: "hold to slide" },
  { action: "sprint", label: "Sprint Toggle", hint: "click once while moving" },
  { action: "inventory", label: "Inventory", hint: "tap while standing still" },
  { action: "interact", label: "Interact", hint: "talk / use, hold to stow magic" },
  { action: "spellMenu", label: "Spell Book", hint: "open spell menu" },
  { action: "map", label: "Map", hint: "toggle minimap" },
  { action: "scoreboard", label: "Player List", hint: "hold to view score" },
  { action: "pause", label: "Pause / Resume", hint: "pause menu" },
  { action: "menuSelect", label: "Menu Select", hint: "confirm highlighted option" },
  { action: "menuBack", label: "Menu Back", hint: "exit/back from menus" },
  { action: "leftHotbar", label: "Left Hotbar", hint: "tap next, D-pad changes direction" },
  { action: "rightHotbar", label: "Right Hotbar", hint: "tap next, D-pad changes direction" },
  { action: "voicePushToTalk", label: "Voice Push-To-Talk", hint: "hold to talk when voice is press-to-talk" },
];
