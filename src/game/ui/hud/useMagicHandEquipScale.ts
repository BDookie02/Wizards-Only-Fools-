import { useEffect, useState } from "react";

function roundEquipScale(value: number) {
  return Math.round(value * 10) / 10;
}

type SteppedToggleValueOptions = {
  isActive: boolean;
  minValue: number;
  maxValue: number;
  step: number;
  intervalMs: number;
  roundValue?: (value: number) => number;
};

export function useSteppedToggleValue({
  isActive,
  minValue,
  maxValue,
  step,
  intervalMs,
  roundValue = (value) => value,
}: SteppedToggleValueOptions) {
  const [value, setValue] = useState(minValue);

  useEffect(() => {
    const shouldIncrease = isActive && value < maxValue;
    const shouldDecrease = !isActive && value > minValue;
    if (!shouldIncrease && !shouldDecrease) return;

    const animTimeout = window.setTimeout(() => {
      setValue((previous) => {
        const next = isActive
          ? Math.min(maxValue, previous + step)
          : Math.max(minValue, previous - step);
        return roundValue(next);
      });
    }, intervalMs);

    return () => {
      window.clearTimeout(animTimeout);
    };
  }, [intervalMs, isActive, maxValue, minValue, roundValue, step, value]);

  return value;
}

export function useMagicHandEquipScale(isActive: boolean, step = 0.2, intervalMs = 30) {
  return useSteppedToggleValue({
    isActive,
    minValue: 0,
    maxValue: 1,
    step,
    intervalMs,
    roundValue: roundEquipScale,
  });
}
