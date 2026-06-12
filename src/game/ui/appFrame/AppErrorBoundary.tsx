import { Component, type ReactNode } from "react";

type AppErrorBoundaryState = {
  error: Error | null;
  ignoredRapierTeardownAt: number;
};

let rapierTeardownWindowStartedAt = 0;
let rapierTeardownErrorsInWindow = 0;

export function getAppErrorBoundaryNowMs() {
  return Date.now();
}

function isKnownRapierTeardownError(error: unknown) {
  const text = String(error instanceof Error ? error.stack || error.message : error);
  return (
    /removeRigidBody|@react-three_rapier|CanvasImpl/.test(text) &&
    /recursive use of an object detected|unsafe aliasing|expected instance/i.test(text)
  );
}

function shouldIgnoreRapierTeardownError(error: unknown) {
  if (!isKnownRapierTeardownError(error)) return false;

  const now = getAppErrorBoundaryNowMs();
  if (now - rapierTeardownWindowStartedAt > 1500) {
    rapierTeardownWindowStartedAt = now;
    rapierTeardownErrorsInWindow = 0;
  }
  rapierTeardownErrorsInWindow += 1;

  return rapierTeardownErrorsInWindow <= 24;
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  state = { error: null, ignoredRapierTeardownAt: 0 };

  static getDerivedStateFromError(error: Error) {
    if (shouldIgnoreRapierTeardownError(error)) {
      return { error: null, ignoredRapierTeardownAt: getAppErrorBoundaryNowMs() };
    }
    return { error };
  }

  componentDidCatch(error: Error) {
    if (!isKnownRapierTeardownError(error) || typeof document === "undefined") return;

    const count = Number(document.documentElement.dataset.wofIgnoredRapierTeardownErrors || "0");
    document.documentElement.dataset.wofIgnoredRapierTeardownErrors = String(count + 1);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="text-red-500 z-50 absolute p-10 bg-black inset-0">
          {String((this.state.error as Error).stack || this.state.error)}
        </div>
      );
    }
    return this.props.children;
  }
}
