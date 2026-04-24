"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  getHapticsPreference,
  isHapticsSupported,
  setHapticsPreference,
  subscribeToHapticsPreference,
  triggerHaptic,
  type HapticEvent,
} from "@/lib/haptics";

export function useHaptics() {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const enabled = useSyncExternalStore(
    subscribeToHapticsPreference,
    getHapticsPreference,
    () => true
  );
  const supported = useMemo(() => (ready ? isHapticsSupported() : false), [ready]);

  const updateEnabled = useCallback((nextEnabled: boolean) => {
    setHapticsPreference(nextEnabled);
  }, []);

  const trigger = useCallback(
    (event: HapticEvent, overrideEnabled?: boolean) => {
      return triggerHaptic(event, { enabled: overrideEnabled ?? enabled });
    },
    [enabled]
  );

  return {
    enabled,
    supported,
    ready,
    setEnabled: updateEnabled,
    trigger,
  };
}
