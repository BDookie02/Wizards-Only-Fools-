import { createPortal } from "react-dom";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { sanitizePlayerName } from "../../../store/gameStore";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type PlayerNamePromptProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function PlayerNamePrompt({
  value,
  onChange,
  onSubmit,
}: PlayerNamePromptProps) {
  const cleaned = sanitizePlayerName(value);
  const canSubmit = cleaned.length >= 2;

  return createPortal(
    <div
      data-testid="player-name-prompt"
      className="fixed inset-0 z-[240] flex items-center justify-center bg-[#050207]/92 px-4 font-mono text-white pointer-events-auto"
      style={{ width: "var(--app-vw, 100dvw)", height: "var(--app-vh, 100dvh)" }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <form
        className="w-[min(520px,calc(100vw-28px))] border-2 border-purple-300/70 bg-[#100718]/95 p-4 shadow-[0_0_40px_rgba(168,85,247,0.35)]"
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (canSubmit) onSubmit();
        }}
      >
        <div className="text-center text-[clamp(1rem,4vmin,1.65rem)] tracking-[0.18em] text-yellow-200">
          Name Your Wizard
        </div>
        <div className="mt-3 text-center text-[10px] leading-5 tracking-widest text-purple-100/75">
          This is what other players will see when you join the lobby and when you get defeated.
        </div>
        <input
          autoFocus
          aria-label="Player name"
          value={value}
          maxLength={18}
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          placeholder="enter wizard name"
          className="normal-case mt-4 w-full border-2 border-[#888] border-b-[#222] border-r-[#222] bg-black px-3 py-3 text-center text-[clamp(0.9rem,3vmin,1.3rem)] text-white outline-none focus:border-yellow-200"
          onChange={(e) => onChange(sanitizePlayerName(e.target.value))}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <div className="mt-2 min-h-[1rem] text-center text-[9px] tracking-widest text-cyan-100/55">
          Letters, numbers, spaces, underscores, and hyphens. 2-18 characters.
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            "mt-4 w-full border-2 px-4 py-3 text-[clamp(0.78rem,2.3vmin,1rem)] tracking-widest transition-all",
            canSubmit
              ? "border-yellow-200 bg-yellow-300/15 text-yellow-100 hover:bg-yellow-300/25"
              : "cursor-not-allowed border-gray-600 bg-gray-900 text-gray-500"
          )}
        >
          Join Lobby
        </button>
      </form>
    </div>,
    document.body
  );
}
