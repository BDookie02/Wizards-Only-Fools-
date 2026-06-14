import { getSpriteUrl } from "../../SpriteManifest";

export function MobileTopActions({
  openSpellMenu,
  pauseTouchGameplay,
  openEngineMenu,
  showEngineMenuButton = false,
}: {
  openSpellMenu: () => void;
  pauseTouchGameplay: () => void;
  openEngineMenu?: () => void;
  showEngineMenuButton?: boolean;
}) {
  const spellbookIconUrl =
    getSpriteUrl("/sprites/misc/spellbook_icon.png") ||
    getSpriteUrl("/sprites/misc/spellbook.gif") ||
    "/sprites/misc/spellbook_icon.png";

  return (
    <div className="mobile-top-actions absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap gap-2">
      <button
        data-testid="mobile-open-spell-menu"
        aria-label="Open spell book"
        title="Open spell book"
        className="mobile-spellbook-button pointer-events-auto flex h-12 w-12 items-center justify-center overflow-visible border-0 bg-transparent p-0 text-[9px] text-cyan-50 active:scale-95"
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); openSpellMenu(); }}
      >
        <img
          src={spellbookIconUrl}
          alt=""
          crossOrigin="anonymous"
          decoding="async"
          className="h-full w-full object-contain [image-rendering:pixelated]"
          style={{
            filter: "brightness(1.12) contrast(1.1) saturate(1.08)",
          }}
          onError={(e) => {
            e.currentTarget.classList.add("hidden");
            e.currentTarget.nextElementSibling?.classList.remove("hidden");
          }}
        />
        <span className="hidden font-mono tracking-widest">SPELL</span>
      </button>
      <button
        data-testid="mobile-pause"
        aria-label="Pause"
        title="Pause"
        className="mobile-pause-button pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border-2 border-cyan-100/40 bg-black/55 active:scale-95 active:bg-white/15"
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); pauseTouchGameplay(); }}
      >
        <span className="flex h-5 w-4 items-center justify-between" aria-hidden="true">
          <span className="h-full w-1.5 rounded-sm bg-cyan-50" />
          <span className="h-full w-1.5 rounded-sm bg-cyan-50" />
        </span>
      </button>
      {showEngineMenuButton && openEngineMenu && (
        <button
          data-testid="mobile-open-engine-menu"
          aria-label="Open engine menu"
          title="Open engine menu"
          className="mobile-engine-button pointer-events-auto flex h-11 w-11 items-center justify-center rounded-md border-2 border-yellow-100/45 bg-yellow-300/15 text-[10px] font-bold tracking-widest text-yellow-50 active:scale-95 active:bg-yellow-200/25"
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); openEngineMenu(); }}
        >
          DEV
        </button>
      )}
    </div>
  );
}
