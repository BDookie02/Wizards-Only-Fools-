import * as THREE from "three";
import { getSpriteUrl } from "../../SpriteManifest";

const resolveSpellSpriteUrls = (paths: readonly string[]) => {
  const urls = new Array<string>(paths.length);
  for (let index = 0; index < paths.length; index += 1) {
    const path = paths[index];
    urls[index] = getSpriteUrl(path) || path;
  }
  return urls;
};

const FIREBALL_TEXTURE_PATHS = [
  "/sprites/fireball/fireball_1.png",
  "/sprites/fireball/fireball_2.png",
  "/sprites/fireball/fireball_3.png",
  "/sprites/fireball/fireball_4.png",
  "/sprites/fireball/fireball_5.png",
] as const;

const ICESPELL_TEXTURE_PATHS = [
  "/sprites/icespell/icespell_1.png",
  "/sprites/icespell/icespell_2.png",
  "/sprites/icespell/icespell_3.png",
  "/sprites/icespell/icespell_4.png",
  "/sprites/icespell/icespell_5.png",
  "/sprites/icespell/icespell_6.png",
  "/sprites/icespell/icespell_7.png",
  "/sprites/icespell/icespell_8.png",
] as const;

const ICESHARD_TEXTURE_PATHS = [
  "/sprites/iceshard/spells_1.png",
  "/sprites/iceshard/spells_2.png",
  "/sprites/iceshard/spells_3.png",
  "/sprites/iceshard/spells_4.png",
  "/sprites/iceshard/spells_5.png",
  "/sprites/iceshard/spells_6.png",
] as const;

const RINGSOFPOWER_TEXTURE_PATHS = [
  "/sprites/ringsofpower/ringsofpower_1.png",
  "/sprites/ringsofpower/ringsofpower_2.png",
  "/sprites/ringsofpower/ringsofpower_3.png",
  "/sprites/ringsofpower/ringsofpower_4.png",
  "/sprites/ringsofpower/ringsofpower_5.png",
  "/sprites/ringsofpower/ringsofpower_6.png",
  "/sprites/ringsofpower/ringsofpower_7.png",
] as const;

const PALPITATE_TEXTURE_PATHS = [
  "/sprites/lightning/palpitate_1.png",
  "/sprites/lightning/palpitate_2.png",
  "/sprites/lightning/palpitate_3.png",
  "/sprites/lightning/palpitate_4.png",
  "/sprites/lightning/palpitate_5.png",
  "/sprites/lightning/palpitate_6.png",
  "/sprites/lightning/palpitate_7.png",
  "/sprites/lightning/palpitate_8.png",
  "/sprites/lightning/palpitate_9.png",
  "/sprites/lightning/palpitate_10.png",
  "/sprites/lightning/palpitate_11.png",
] as const;

export const FIREBALL_TEXTURES = resolveSpellSpriteUrls(FIREBALL_TEXTURE_PATHS);
export const ICESPELL_TEXTURES = resolveSpellSpriteUrls(ICESPELL_TEXTURE_PATHS);
export const ICESHARD_TEXTURES = resolveSpellSpriteUrls(ICESHARD_TEXTURE_PATHS);
export const RINGSOFPOWER_TEXTURES = resolveSpellSpriteUrls(RINGSOFPOWER_TEXTURE_PATHS);
export const PALPITATE_TEXTURES = resolveSpellSpriteUrls(PALPITATE_TEXTURE_PATHS);

export const PORTAL_GIF_URL = getSpriteUrl("/sprites/misc/portal.gif") || "/sprites/misc/portal.gif";

const textureCache: Record<string, THREE.Texture> = {};
const textureLoadCallbacks: Record<string, Array<() => void>> = {};
const textureLoadSettled: Record<string, boolean> = {};

const fallbackTexture = new THREE.DataTexture(new Uint8Array([255, 150, 0, 128]), 1, 1, THREE.RGBAFormat);
fallbackTexture.needsUpdate = true;

function notifyTextureLoadSettled(url: string) {
  const callbacks = textureLoadCallbacks[url];
  if (!callbacks) return;
  delete textureLoadCallbacks[url];
  for (let index = 0; index < callbacks.length; index += 1) {
    callbacks[index]();
  }
}

export function preloadSpellProjectileTextures(urls: string[], onTextureSettled?: () => void) {
  if (typeof window === "undefined") return;

  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const cachedTexture = textureCache[url];
    if (cachedTexture && cachedTexture !== fallbackTexture) continue;
    if (onTextureSettled && !textureLoadSettled[url]) {
      if (!textureLoadCallbacks[url]) textureLoadCallbacks[url] = [];
      textureLoadCallbacks[url].push(onTextureSettled);
    }
    if (cachedTexture) continue;

    textureCache[url] = fallbackTexture;
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        textureCache[url] = texture;
        textureLoadSettled[url] = true;
        notifyTextureLoadSettled(url);
      },
      undefined,
      () => {
        console.warn("Failed to load texture, using fallback:", url);
        textureCache[url] = fallbackTexture;
        textureLoadSettled[url] = true;
        notifyTextureLoadSettled(url);
      },
    );
  }
}

export function getCachedSpellProjectileTextures(urls: string[]) {
  const textures = new Array<THREE.Texture>(urls.length);
  for (let index = 0; index < urls.length; index += 1) {
    textures[index] = textureCache[urls[index]] ?? fallbackTexture;
  }
  return textures;
}
