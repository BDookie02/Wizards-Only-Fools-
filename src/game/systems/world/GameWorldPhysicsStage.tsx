import { Physics } from "@react-three/rapier";
import type { ReactNode } from "react";

export function GameWorldPhysicsStage({ children }: { children: ReactNode }) {
  return (
    <Physics gravity={[0, -20, 0]} updatePriority={-100}>
      {children}
    </Physics>
  );
}
