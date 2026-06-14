export function EngineMenuFooter() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-cyan-100/20 px-3 py-2 text-[8px] tracking-[0.2em] text-cyan-100/45">
      <span>L toggles this menu when dev mode is on</span>
      <span>/engine opens it from command console</span>
      <span>Click an item to preview, then place selected</span>
    </div>
  );
}
