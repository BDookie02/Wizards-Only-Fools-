import { createSeededRandom } from "../../random/seededRandom";

export const getSeededTextureRandom = createSeededRandom;

export function getDarrelPetalNoise(index: number, salt: number) {
  const noise = Math.sin(index * 91.731 + salt * 47.117) * 43758.5453123;
  return noise - Math.floor(noise);
}
