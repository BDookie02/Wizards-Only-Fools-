type SpellMenuVisibleCountProps = {
  count: number;
};

export function SpellMenuVisibleCount({ count }: SpellMenuVisibleCountProps) {
  return (
    <div
      data-testid="spell-menu-visible-count"
      className="spell-menu-visible-count border border-cyan-300/20 bg-black/20 px-2 py-1 text-center text-[8px] tracking-widest text-cyan-100/60"
    >
      {count} SHOWN
    </div>
  );
}
