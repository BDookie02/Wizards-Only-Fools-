import {
  spellFamilyFilters,
  type SpellFamilyFilter,
} from "./spellMenuRuntime";
import { SpellMenuFamilyFilterButton } from "./SpellMenuFamilyFilterButton";
import { SpellMenuVisibleCount } from "./SpellMenuVisibleCount";

type SpellMenuFilterRowProps = {
  activeFamily: SpellFamilyFilter;
  familyCounts: Record<SpellFamilyFilter, number>;
  controllerFocusIndex: number;
  visibleCount: number;
  onFocusNav: (navIndex: number) => void;
  onSelectFamily: (family: SpellFamilyFilter, navIndex: number) => void;
};

export function SpellMenuFilterRow({
  activeFamily,
  familyCounts,
  controllerFocusIndex,
  visibleCount,
  onFocusNav,
  onSelectFamily,
}: SpellMenuFilterRowProps) {
  return (
    <div
      className="spell-menu-family-filters mb-2 grid grid-cols-4 gap-1.5 md:grid-cols-[repeat(8,minmax(0,1fr))]"
      data-testid="spell-menu-family-filters"
    >
      {spellFamilyFilters.map((family) => (
        <SpellMenuFamilyFilterButton
          key={family}
          family={family}
          active={activeFamily === family}
          count={familyCounts[family]}
          controllerFocusIndex={controllerFocusIndex}
          onFocusNav={onFocusNav}
          onSelectFamily={onSelectFamily}
        />
      ))}
      <SpellMenuVisibleCount count={visibleCount} />
    </div>
  );
}
