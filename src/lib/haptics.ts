export type HapticEvent = "selection" | "success" | "error" | "warning";

type HapticPattern = number | number[];

type HapticsNavigator = {
  vibrate?: (pattern: HapticPattern) => boolean;
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
};

const HAPTICS_STORAGE_KEY = "budgetflow:haptics-enabled";
const DEFAULT_HAPTICS_ENABLED = true;
const GLOBAL_COOLDOWN_MS = 120;
const REPEAT_EVENT_COOLDOWN_MS = 400;
const hapticsPreferenceListeners = new Set<() => void>();

const HAPTIC_PATTERNS: Record<HapticEvent, HapticPattern> = {
  selection: 10,
  success: [16, 40, 24],
  error: [30, 45, 30],
  warning: [20, 35, 20],
};

let lastTriggerAt = 0;
let lastTriggerEvent: HapticEvent | null = null;

function getNavigator(override?: HapticsNavigator): HapticsNavigator | null {
  if (override) {
    return override;
  }

  if (typeof navigator === "undefined") {
    return null;
  }

  return navigator as HapticsNavigator;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function getHapticPattern(event: HapticEvent): HapticPattern {
  return HAPTIC_PATTERNS[event];
}

export function isIOSWebEnvironment(navigatorLike?: HapticsNavigator | null): boolean {
  const currentNavigator = navigatorLike ?? getNavigator();

  if (!currentNavigator) {
    return false;
  }

  const userAgent = currentNavigator.userAgent ?? "";
  const platform = currentNavigator.platform ?? "";
  const maxTouchPoints = currentNavigator.maxTouchPoints ?? 0;

  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    return true;
  }

  return /Mac/i.test(platform) && maxTouchPoints > 1;
}

export function isHapticsSupported(navigatorLike?: HapticsNavigator | null): boolean {
  const currentNavigator = navigatorLike ?? getNavigator();

  if (!currentNavigator || typeof currentNavigator.vibrate !== "function") {
    return false;
  }

  return !isIOSWebEnvironment(currentNavigator);
}

export function getHapticsPreference(): boolean {
  const storage = getStorage();

  if (!storage) {
    return DEFAULT_HAPTICS_ENABLED;
  }

  try {
    const storedPreference = storage.getItem(HAPTICS_STORAGE_KEY);

    if (storedPreference === null) {
      return DEFAULT_HAPTICS_ENABLED;
    }

    return storedPreference === "true";
  } catch {
    return DEFAULT_HAPTICS_ENABLED;
  }
}

export function setHapticsPreference(enabled: boolean): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  try {
    storage.setItem(HAPTICS_STORAGE_KEY, enabled ? "true" : "false");
    hapticsPreferenceListeners.forEach((listener) => listener());
  } catch {
    // localStorage access can fail in private or restricted browser contexts.
  }
}

export function subscribeToHapticsPreference(listener: () => void): () => void {
  hapticsPreferenceListeners.add(listener);

  return () => {
    hapticsPreferenceListeners.delete(listener);
  };
}

function shouldTriggerHaptic(event: HapticEvent, now: number): boolean {
  if (lastTriggerAt !== 0 && now - lastTriggerAt < GLOBAL_COOLDOWN_MS) {
    return false;
  }

  if (lastTriggerEvent === event && lastTriggerAt !== 0 && now - lastTriggerAt < REPEAT_EVENT_COOLDOWN_MS) {
    return false;
  }

  return true;
}

export function triggerHaptic(
  event: HapticEvent,
  options: {
    enabled?: boolean;
    navigator?: HapticsNavigator | null;
    now?: number;
  } = {}
): boolean {
  const enabled = options.enabled ?? getHapticsPreference();
  const currentNavigator = options.navigator ?? getNavigator();
  const now = options.now ?? Date.now();

  if (!enabled || !isHapticsSupported(currentNavigator) || !shouldTriggerHaptic(event, now)) {
    return false;
  }

  const didVibrate = currentNavigator?.vibrate?.(getHapticPattern(event)) === true;

  if (!didVibrate) {
    return false;
  }

  lastTriggerAt = now;
  lastTriggerEvent = event;

  return true;
}

export function resetHapticsState(): void {
  lastTriggerAt = 0;
  lastTriggerEvent = null;
}
