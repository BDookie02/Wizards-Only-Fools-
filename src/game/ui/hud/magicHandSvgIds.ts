export function getMagicHandSvgIdSuffix(id: string) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "") || "magic-hand-effect";
}
