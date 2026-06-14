type Ref<T> = {
  current: T;
};

export type HudControllerButtonsRef = Ref<Record<string, boolean>>;
export type HudControllerRepeatRef = Ref<Partial<Record<string, number>>>;

export function consumeHudControllerPress(
  controllerButtonsRef: HudControllerButtonsRef,
  key: string,
  pressed: boolean,
) {
  const wasPressed = controllerButtonsRef.current[key] ?? false;
  controllerButtonsRef.current[key] = pressed;
  return pressed && !wasPressed;
}

export function consumeHudControllerRepeat(
  controllerButtonsRef: HudControllerButtonsRef,
  controllerRepeatRef: HudControllerRepeatRef,
  key: string,
  pressed: boolean,
  now: number,
  firstDelay = 260,
  repeatDelay = 170,
) {
  const wasPressed = controllerButtonsRef.current[key] ?? false;
  controllerButtonsRef.current[key] = pressed;

  if (!pressed) {
    delete controllerRepeatRef.current[key];
    return false;
  }

  if (!wasPressed) {
    controllerRepeatRef.current[key] = now + firstDelay;
    return true;
  }

  if (now >= (controllerRepeatRef.current[key] ?? 0)) {
    controllerRepeatRef.current[key] = now + repeatDelay;
    return true;
  }

  return false;
}
