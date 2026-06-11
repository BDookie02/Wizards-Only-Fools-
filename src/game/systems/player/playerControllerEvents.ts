type PlayerWindowListener = (event: any) => void;

export type PlayerControllerWindowHandlers = {
  onMouseDown: (event: MouseEvent) => void;
  onMouseUp: (event: MouseEvent) => void;
  onMobileControl: (event: Event) => void;
  onMobileCast: (event: Event) => void;
  onMobileHotbar: (event: Event) => void;
  onWheel: (event: WheelEvent) => void;
  onMeditationKeyDown: (event: KeyboardEvent) => void;
  onMeditationKeyUp: (event: KeyboardEvent) => void;
  onHotbarKeyDown: (event: KeyboardEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
  onTeleport: PlayerWindowListener;
  onPull: PlayerWindowListener;
  onScreenShake: PlayerWindowListener;
  onGrabPlayer: PlayerWindowListener;
  onGrabControl: PlayerWindowListener;
  onReleaseGrabPlayer: PlayerWindowListener;
  onCommandConsoleOpened: () => void;
  onControllerGameplayStarted: () => void;
};

export function installPlayerControllerWindowListeners(handlers: PlayerControllerWindowHandlers) {
  if (typeof window === "undefined") return () => {};

  const listeners: Array<[string, PlayerWindowListener]> = [
    ["mousedown", handlers.onMouseDown],
    ["mouseup", handlers.onMouseUp],
    ["mobile-control", handlers.onMobileControl],
    ["mobile-cast", handlers.onMobileCast],
    ["mobile-hotbar", handlers.onMobileHotbar],
    ["wheel", handlers.onWheel],
    ["keydown", handlers.onMeditationKeyDown],
    ["keyup", handlers.onMeditationKeyUp],
    ["keydown", handlers.onHotbarKeyDown],
    ["contextmenu", handlers.onContextMenu],
    ["teleportPlayer", handlers.onTeleport],
    ["pullPlayer", handlers.onPull],
    ["screenShake", handlers.onScreenShake],
    ["grabPlayer", handlers.onGrabPlayer],
    ["grabControl", handlers.onGrabControl],
    ["releaseGrabPlayer", handlers.onReleaseGrabPlayer],
    ["command-console-opened", handlers.onCommandConsoleOpened],
    ["controller-gameplay-started", handlers.onControllerGameplayStarted],
  ];

  for (let index = 0; index < listeners.length; index += 1) {
    const [type, listener] = listeners[index];
    window.addEventListener(type, listener as EventListener);
  }

  return () => {
    for (let index = 0; index < listeners.length; index += 1) {
      const [type, listener] = listeners[index];
      window.removeEventListener(type, listener as EventListener);
    }
  };
}
