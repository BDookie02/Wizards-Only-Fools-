import { lazy } from "react";

export const LazyBaseVillageScene = lazy(() =>
  import("./villages/BaseVillageScene").then((module) => ({ default: module.BaseVillageScene })),
);
export const LazyClassicSkyEnvironment = lazy(() =>
  import("../rendering/sky/ClassicSkyEnvironment").then((module) => ({ default: module.ClassicSkyEnvironment })),
);
export const LazyCanvasRuntimeProbe = lazy(() =>
  import("../rendering/canvas/CanvasRuntimeProbe").then((module) => ({ default: module.CanvasRuntimeProbe })),
);
export const LazyEnginePlacedObjects = lazy(() =>
  import("../placeables/EnginePlacedObjects").then((module) => ({ default: module.EnginePlacedObjects })),
);
export const LazyGameWorldPhysicsStage = lazy(() =>
  import("./GameWorldPhysicsStage").then((module) => ({ default: module.GameWorldPhysicsStage })),
);
export const LazyLiveMiniMap = lazy(() => import("../../LiveMiniMap").then((module) => ({ default: module.LiveMiniMap })));
export const LazyNetworkManager = lazy(() => import("../../network/NetworkManager").then((module) => ({ default: module.NetworkManager })));
export const LazyPlayerController = lazy(() =>
  import("../../PlayerController").then((module) => ({ default: module.PlayerController })),
);
export const LazyProjectiles = lazy(() => import("../../Projectiles").then((module) => ({ default: module.Projectiles })));
export const LazyDevSpellTestDummies = lazy(() =>
  import("../spells/spellDummyQaScene").then((module) => ({ default: module.DevSpellTestDummies })),
);
export const LazyPersistentQuestNpcs = lazy(() =>
  import("../../Villagers").then((module) => ({ default: module.PersistentQuestNpcs })),
);
export const LazyQuestNavigationBeacons = lazy(() =>
  import("../quests/QuestNavigationBeacons").then((module) => ({ default: module.QuestNavigationBeacons })),
);
export const LazyRunes = lazy(() => import("../../Runes").then((module) => ({ default: module.Runes })));
export const LazySurvivalProceduralWorld = lazy(() =>
  import("./survival/survivalProceduralWorldRendering").then((module) => ({ default: module.SurvivalProceduralWorld })),
);
