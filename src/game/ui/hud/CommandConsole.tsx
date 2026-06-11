import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { getHudCommandSuggestions } from "./hudCommandConsoleRuntime";

export type CommandConsoleProps = {
  value: string;
  isVClipEnabled: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function CommandConsole({
  value,
  isVClipEnabled,
  onChange,
  onClose,
  onSubmit,
}: CommandConsoleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = getHudCommandSuggestions(value, 6);

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);

  return createPortal(
    <div
      data-testid="command-console"
      className="fixed left-1/2 z-[235] -translate-x-1/2 border-2 border-cyan-200/70 bg-[#050711]/95 p-2.5 font-mono text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,0.32)] pointer-events-auto"
      style={{
        top: "max(0.75rem, env(safe-area-inset-top))",
        width: "min(720px, calc(var(--app-vw, 100dvw) - 20px))",
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.18em] text-cyan-100/70">
        <span>Chat Console</span>
        <span className={isVClipEnabled ? "text-emerald-200" : "text-slate-400"}>
          VCLIP {isVClipEnabled ? "ON" : "OFF"}
        </span>
      </div>
      <input
        ref={inputRef}
        aria-label="Chat command console"
        autoCapitalize="off"
        autoCorrect="off"
        autoFocus
        spellCheck={false}
        maxLength={90}
        value={value}
        className="normal-case w-full border border-cyan-300/55 bg-black/85 px-3 py-2.5 text-[14px] leading-5 tracking-normal text-cyan-50 outline-none placeholder:text-cyan-100/35 focus:border-yellow-200"
        placeholder="/navrecord start"
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.command}
            type="button"
            className="min-h-9 border border-cyan-300/25 bg-cyan-300/10 px-2 py-1 text-left leading-tight text-cyan-50/85 transition-colors hover:border-yellow-200/70 hover:bg-yellow-200/10 focus:border-yellow-200 focus:outline-none"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange(suggestion.sample);
              window.requestAnimationFrame(() => {
                const input = inputRef.current;
                input?.focus();
                input?.setSelectionRange(suggestion.sample.length, suggestion.sample.length);
              });
            }}
          >
            <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-cyan-100">{suggestion.label}</span>
            <span className="block truncate text-[10px] normal-case tracking-normal text-cyan-100/55">{suggestion.sample}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
