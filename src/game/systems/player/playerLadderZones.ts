type MutableRef<T> = {
  current: T;
};

export function installPlayerLadderZoneListeners(activeLadderZones: MutableRef<Set<string>>) {
  if (typeof window === "undefined") return () => {};

  const handleLadderEnter = (event: Event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (id) activeLadderZones.current.add(id);
  };
  const handleLadderExit = (event: Event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (id) activeLadderZones.current.delete(id);
  };

  window.addEventListener("wof-ladder-zone-enter", handleLadderEnter);
  window.addEventListener("wof-ladder-zone-exit", handleLadderExit);

  return () => {
    window.removeEventListener("wof-ladder-zone-enter", handleLadderEnter);
    window.removeEventListener("wof-ladder-zone-exit", handleLadderExit);
    activeLadderZones.current.clear();
  };
}
