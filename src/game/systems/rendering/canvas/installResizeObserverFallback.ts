import { installResizeObserverFallback } from "./resizeObserverFallback";
import { isQaTelemetryRouteEnabledFromSearch } from "../../../tools/qa/qaRouteTelemetry";

function isLocalCanvasQaRoute() {
  if (typeof window === "undefined") return false;
  if (!import.meta.env.DEV) return false;

  const { hostname, search } = window.location;
  const isLocalHost = hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local");
  if (!isLocalHost) return false;

  return isQaTelemetryRouteEnabledFromSearch(search, [
    "perf",
    "survival",
    "spellDummies",
    "touch",
    "mobilePerf",
    "mountain",
  ]);
}

installResizeObserverFallback({ force: isLocalCanvasQaRoute() });
