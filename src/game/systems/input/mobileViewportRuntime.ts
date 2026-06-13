export type AppViewportSize = {
  width: number;
  height: number;
};

export type AppViewportCssVarsOptions = {
  useVisualViewport?: boolean;
};

export type AppViewportMetrics = {
  innerWidth: number;
  innerHeight: number;
  visualViewportWidth?: number;
  visualViewportHeight?: number;
  useVisualViewport: boolean;
  coverIOSViewport: boolean;
};

export function resolveAppViewportSizeFromMetrics({
  innerWidth,
  innerHeight,
  visualViewportWidth,
  visualViewportHeight,
  useVisualViewport,
  coverIOSViewport,
}: AppViewportMetrics): AppViewportSize {
  const viewportWidth = visualViewportWidth ?? innerWidth;
  const viewportHeight = visualViewportHeight ?? innerHeight;
  const rawWidth = useVisualViewport
    ? coverIOSViewport ? Math.max(viewportWidth, innerWidth) : viewportWidth
    : innerWidth;
  const rawHeight = useVisualViewport
    ? coverIOSViewport ? Math.max(viewportHeight, innerHeight) : viewportHeight
    : innerHeight;

  return {
    width: Math.max(1, Math.round(rawWidth)),
    height: Math.max(1, Math.round(rawHeight)),
  };
}
