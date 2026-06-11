import type { CharacterCustomization } from "../../../store/gameStore";
import { characterColorPresets, characterColorRows, characterMouthRows, characterStyleRows } from "./characterCustomizationConfig";
import { cycleOption, normalizeHexInput, wrapIndex } from "./hudSettingsUtils";
import {
  characterColorStartIndex,
  characterMouthStartIndex,
  characterStyleStartIndex,
} from "./hudSettingsPanelConfig";

export function getCharacterCustomizationUpdate(
  key: keyof CharacterCustomization,
  value: string,
): Partial<CharacterCustomization> {
  return { [key]: value } as Partial<CharacterCustomization>;
}

export function getCharacterColorTextUpdate(
  key: keyof CharacterCustomization,
  value: string,
): Partial<CharacterCustomization> {
  return getCharacterCustomizationUpdate(key, normalizeHexInput(value));
}

export function getNextCharacterColorUpdate(
  characterCustomization: CharacterCustomization,
  key: keyof CharacterCustomization,
  direction: 1 | -1,
): Partial<CharacterCustomization> {
  const current = normalizeHexInput(String(characterCustomization[key] ?? "")).toLowerCase();
  let presetIndex = -1;
  for (let index = 0; index < characterColorPresets.length; index += 1) {
    if (characterColorPresets[index].toLowerCase() === current) {
      presetIndex = index;
      break;
    }
  }
  const nextColor = characterColorPresets[wrapIndex((presetIndex === -1 ? 0 : presetIndex) + direction, characterColorPresets.length)];
  return getCharacterCustomizationUpdate(key, nextColor);
}

export function getNextCharacterStyleUpdate(
  characterCustomization: CharacterCustomization,
  key: keyof CharacterCustomization,
  options: string[],
  direction: 1 | -1,
): Partial<CharacterCustomization> {
  return getCharacterCustomizationUpdate(key, cycleOption(options, String(characterCustomization[key]), direction));
}

export function getCharacterCustomizationStep(
  characterCustomization: CharacterCustomization,
  index: number,
  direction: 1 | -1,
): Partial<CharacterCustomization> | null {
  const colorIndex = index - characterColorStartIndex;
  if (colorIndex >= 0 && colorIndex < characterColorRows.length) {
    return getNextCharacterColorUpdate(characterCustomization, characterColorRows[colorIndex].key, direction);
  }

  const styleIndex = index - characterStyleStartIndex;
  if (styleIndex >= 0 && styleIndex < characterStyleRows.length) {
    const row = characterStyleRows[styleIndex];
    return getNextCharacterStyleUpdate(characterCustomization, row.key, row.options, direction);
  }

  const mouthIndex = index - characterMouthStartIndex;
  if (mouthIndex >= 0 && mouthIndex < characterMouthRows.length) {
    const row = characterMouthRows[mouthIndex];
    return getNextCharacterStyleUpdate(characterCustomization, row.key, row.options, direction);
  }

  return null;
}
