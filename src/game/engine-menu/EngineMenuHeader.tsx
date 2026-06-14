type EngineMenuHeaderProps = {
  onClose: () => void;
};

export function EngineMenuHeader({ onClose }: EngineMenuHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cyan-100/25 px-3 py-2">
      <div>
        <div className="text-[10px] tracking-[0.3em] text-cyan-100/60">Dev Mode</div>
        <div className="text-[clamp(1rem,2.5vmin,1.45rem)] tracking-[0.18em] text-cyan-50">Game Engine Menu</div>
      </div>
      <button
        type="button"
        className="border border-cyan-100/50 bg-cyan-300/10 px-3 py-2 text-[10px] tracking-widest text-cyan-50 hover:bg-cyan-200/20"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}
