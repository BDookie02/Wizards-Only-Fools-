export type EnginePlaceableEvent<TDetail = unknown> = {
  type: string;
  detail: TDetail;
};

type EnginePlaceableEventListener<TDetail = unknown> = (event: EnginePlaceableEvent<TDetail>) => void;

const enginePlaceableListeners = new Map<string, Set<EnginePlaceableEventListener>>();

export function subscribeEnginePlaceableEvent<TDetail>(
  eventName: string,
  listener: EnginePlaceableEventListener<TDetail>
) {
  let listeners = enginePlaceableListeners.get(eventName);
  if (!listeners) {
    listeners = new Set();
    enginePlaceableListeners.set(eventName, listeners);
  }
  const genericListener = listener as EnginePlaceableEventListener;
  listeners.add(genericListener);
  return () => {
    listeners?.delete(genericListener);
    if (listeners?.size === 0) {
      enginePlaceableListeners.delete(eventName);
    }
  };
}

function publishEnginePlaceableBusEvent<TDetail>(eventName: string, detail: TDetail) {
  const listeners = enginePlaceableListeners.get(eventName);
  if (!listeners || listeners.size === 0) return false;
  const event = { type: eventName, detail };
  const listenerSnapshot: EnginePlaceableEventListener[] = [];
  for (const listener of listeners) {
    listenerSnapshot.push(listener);
  }
  for (let index = 0; index < listenerSnapshot.length; index += 1) {
    listenerSnapshot[index](event);
  }
  return true;
}

function dispatchDomCustomEvent<TDetail>(eventName: string, detail: TDetail) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
    return false;
  }

  let event: Event | null = null;
  if (typeof window.CustomEvent === "function") {
    event = new CustomEvent(eventName, { detail });
  } else if (typeof document !== "undefined" && typeof document.createEvent === "function") {
    const customEvent = document.createEvent("CustomEvent");
    customEvent.initCustomEvent(eventName, false, false, detail);
    event = customEvent;
  }

  if (!event) return false;
  window.dispatchEvent(event);
  return true;
}

export function dispatchEnginePlaceableEvent<TDetail>(eventName: string, detail?: TDetail) {
  const busDelivered = publishEnginePlaceableBusEvent(eventName, detail);
  const domDelivered = dispatchDomCustomEvent(eventName, detail);
  return busDelivered || domDelivered;
}

export function dispatchEnginePlaceableSignal(eventName: string) {
  return dispatchEnginePlaceableEvent(eventName, undefined);
}
