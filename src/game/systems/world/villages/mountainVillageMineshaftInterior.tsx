import { MountainMineshaftCatwalkRingView } from "./mountainVillageMineshaftCatwalk";
import { MountainMineshaftMiniHutView } from "./mountainVillageMineshaftHut";
import { MountainMineshaftLadderView } from "./mountainVillageMineshaftLadder";
import type { MountainVillageLayout } from "./mountainVillageSceneLayout";

export function MountainMineshaftInteriorView({ layout, showDetails }: { layout: MountainVillageLayout; showDetails: boolean }) {
  return (
    <group name="mountain-village-mineshaft-wall-huts">
      {layout.interiorHuts.map((hut, index) => (
        <MountainMineshaftCatwalkRingView
          key={`${hut.key}-catwalk-ring`}
          hut={hut}
          ladder={layout.interiorLadders[index]}
          nextLadder={layout.interiorLadders[index + 1]}
          showDetails={showDetails}
        />
      ))}
      {layout.interiorHuts.map((hut, index) => (
        <MountainMineshaftMiniHutView key={hut.key} hut={hut} ladder={layout.interiorLadders[index]} showDetails={showDetails} />
      ))}
      {layout.interiorLadders.map((ladder) => (
        <MountainMineshaftLadderView key={ladder.key} ladder={ladder} showDetails={showDetails} />
      ))}
    </group>
  );
}
