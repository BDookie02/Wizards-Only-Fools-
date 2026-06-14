import { lazy, Suspense } from "react";
import type { CharacterCustomization } from "../../../store/gameStore";
import { cn, settingsHintClass } from "./settingsPanelClassNames";

const LazyCharacterPreview = lazy(() => import("./CharacterPreview").then((module) => ({ default: module.CharacterPreview })));

type SettingsCharacterPreviewCardProps = {
  characterCustomization: CharacterCustomization;
  onReset: () => void;
};

export function SettingsCharacterPreviewCard({
  characterCustomization,
  onReset,
}: SettingsCharacterPreviewCardProps) {
  return (
    <div className="settings-card character-preview-card border border-pink-300/25 bg-pink-400/5 p-2">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-pink-300/20 pb-1">
        <div className="settings-section-title tracking-[0.2em] text-pink-100">Live Character View</div>
        <button
          className="settings-mini-button border border-yellow-200/40 bg-yellow-200/10 px-2 py-1 tracking-widest text-yellow-100 hover:bg-yellow-200/20"
          onClick={onReset}
        >
          Reset Base
        </button>
      </div>
      <Suspense fallback={null}>
        <LazyCharacterPreview character={characterCustomization} />
      </Suspense>
      <div className={cn("mt-2 text-pink-100/50", settingsHintClass)}>
        Placeholder clothes and hair are procedural today; later sprite sheets can slot into these same style categories.
      </div>
    </div>
  );
}
