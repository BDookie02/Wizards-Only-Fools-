import { Environment, Sky } from "@react-three/drei";

export function ClassicSkyEnvironment() {
  return (
    <>
      <Sky sunPosition={[50, 20, 50]} turbidity={0.3} rayleigh={0.5} />
      <Environment preset="sunset" />
    </>
  );
}
