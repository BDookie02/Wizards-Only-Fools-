import { isCurrentQaTelemetryRouteEnabled, type QaTelemetryRoute } from "./qaRouteTelemetry";

const SPELL_DUMMY_QA_ROUTES: readonly QaTelemetryRoute[] = ["spellDummies"];

export function isCurrentSpellDummyQaRouteEnabled() {
  return isCurrentQaTelemetryRouteEnabled(SPELL_DUMMY_QA_ROUTES);
}
