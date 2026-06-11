export type SurvivalFlowerBloomType = "star" | "round" | "bell" | "puff";

export type SurvivalFlowerBloomGroups<T extends { bloomType?: SurvivalFlowerBloomType }> = {
  star: T[];
  round: T[];
  bell: T[];
  puff: T[];
};

export function splitSurvivalFlowersByBloomType<T extends { bloomType?: SurvivalFlowerBloomType }>(
  flowers: readonly T[],
): SurvivalFlowerBloomGroups<T> {
  const groups: SurvivalFlowerBloomGroups<T> = {
    star: [],
    round: [],
    bell: [],
    puff: [],
  };

  for (let index = 0; index < flowers.length; index += 1) {
    const flower = flowers[index];
    if (flower.bloomType === "star") {
      groups.star.push(flower);
    } else if (flower.bloomType === "round") {
      groups.round.push(flower);
    } else if (flower.bloomType === "bell") {
      groups.bell.push(flower);
    } else if (flower.bloomType === "puff") {
      groups.puff.push(flower);
    }
  }

  return groups;
}
