export type HudScoreboardSource = "keyboard" | "controller";

export type HudScoreboardSourceUpdate = {
  changed: boolean;
  keyboardOpen: boolean;
  controllerOpen: boolean;
  open: boolean;
  shouldSetOpen: boolean;
};

export function countOwnRecordEntries(record: Record<string, unknown>): number {
  let count = 0;
  for (const key in record) {
    if (Object.prototype.hasOwnProperty.call(record, key)) count += 1;
  }
  return count;
}

export function getHudScoreboardSourceUpdate({
  source,
  open,
  keyboardOpen,
  controllerOpen,
  currentOpen,
}: {
  source: HudScoreboardSource;
  open: boolean;
  keyboardOpen: boolean;
  controllerOpen: boolean;
  currentOpen: boolean;
}): HudScoreboardSourceUpdate {
  if (source === "keyboard") {
    if (keyboardOpen === open) {
      const nextOpen = keyboardOpen || controllerOpen;
      return {
        changed: false,
        keyboardOpen,
        controllerOpen,
        open: nextOpen,
        shouldSetOpen: false,
      };
    }
    keyboardOpen = open;
  } else {
    if (controllerOpen === open) {
      const nextOpen = keyboardOpen || controllerOpen;
      return {
        changed: false,
        keyboardOpen,
        controllerOpen,
        open: nextOpen,
        shouldSetOpen: false,
      };
    }
    controllerOpen = open;
  }

  const nextOpen = keyboardOpen || controllerOpen;
  return {
    changed: true,
    keyboardOpen,
    controllerOpen,
    open: nextOpen,
    shouldSetOpen: currentOpen !== nextOpen,
  };
}
