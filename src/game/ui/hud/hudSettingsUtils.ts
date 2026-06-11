export function wrapIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

export function normalizeHexInput(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

export function isValidHexColor(value: string) {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function cycleOption(options: string[], current: string, direction: 1 | -1) {
  const index = Math.max(0, options.indexOf(current));
  return options[wrapIndex(index + direction, options.length)];
}

export function formatCharacterOption(value: string) {
  const parts = value.split(/(?=[A-Z])|[-_\s]+/);
  const formattedParts: string[] = [];
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.length > 0) {
      formattedParts.push(`${part.charAt(0).toUpperCase()}${part.slice(1)}`);
    }
  }
  return formattedParts.join(" ");
}

export function formatKeyboardCode(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "Space";
  if (code === "Escape") return "Escape";
  return code
    .replace(/(Left|Right)$/, " $1")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}
