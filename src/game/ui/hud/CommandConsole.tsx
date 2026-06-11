import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

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

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  }, []);

  return createPortal(
    <div
      data-testid="command-console"
      className="fixed left-1/2 top-4 z-[235] w-[min(680px,calc(100dvw-24px))] -translate-x-1/2 border-2 border-cyan-200/70 bg-[#050711]/92 p-2 font-mono text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,0.32)] pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="mb-1 flex items-center justify-between gap-3 text-[9px] uppercase tracking-[0.22em] text-cyan-100/70">
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
        className="normal-case w-full border border-cyan-300/55 bg-black/80 px-3 py-2 text-[13px] tracking-wide text-cyan-50 outline-none placeholder:text-cyan-100/35 focus:border-yellow-200"
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
      <div className="mt-1 text-[8px] uppercase tracking-[0.18em] text-cyan-100/45">
        Try /inventory, /forage leaves, /questdev on, /day, or /vclip on
      </div>
    </div>,
    document.body
  );
}
