import {
  getHapticPattern,
  getHapticsPreference,
  isHapticsSupported,
  isIOSWebEnvironment,
  resetHapticsState,
  setHapticsPreference,
  triggerHaptic,
} from "@/lib/haptics";

describe("haptics", () => {
  const originalNavigator = global.navigator;
  const vibrateMock = jest.fn();

  beforeEach(() => {
    resetHapticsState();
    vibrateMock.mockReset().mockReturnValue(true);
    window.localStorage.clear();

    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        vibrate: vibrateMock,
        userAgent: "Mozilla/5.0 (Linux; Android 15)",
        platform: "Linux armv8l",
        maxTouchPoints: 5,
      },
    });
  });

  afterAll(() => {
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  });

  it("returns the semantic vibration pattern for each event", () => {
    expect(getHapticPattern("selection")).toBe(10);
    expect(getHapticPattern("success")).toEqual([16, 40, 24]);
    expect(getHapticPattern("error")).toEqual([30, 45, 30]);
  });

  it("detects unsupported iOS web environments", () => {
    expect(
      isIOSWebEnvironment({
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        platform: "iPhone",
        maxTouchPoints: 5,
      })
    ).toBe(true);
    expect(isHapticsSupported()).toBe(true);
    expect(
      isHapticsSupported({
        vibrate: vibrateMock,
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
        platform: "iPhone",
        maxTouchPoints: 5,
      })
    ).toBe(false);
  });

  it("stores and reads the local haptics preference", () => {
    expect(getHapticsPreference()).toBe(true);

    setHapticsPreference(false);
    expect(window.localStorage.getItem("budgetflow:haptics-enabled")).toBe("false");
    expect(getHapticsPreference()).toBe(false);
  });

  it("triggers vibration only when supported and enabled", () => {
    expect(triggerHaptic("selection", { enabled: true, now: 1_000 })).toBe(true);
    expect(vibrateMock).toHaveBeenCalledWith(10);

    vibrateMock.mockClear();

    expect(triggerHaptic("success", { enabled: false, now: 2_000 })).toBe(false);
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it("dedupes repeated events during the cooldown window", () => {
    expect(triggerHaptic("selection", { enabled: true, now: 1_000 })).toBe(true);
    expect(triggerHaptic("selection", { enabled: true, now: 1_200 })).toBe(false);
    expect(triggerHaptic("warning", { enabled: true, now: 1_300 })).toBe(true);
    expect(vibrateMock).toHaveBeenCalledTimes(2);
  });

  it("becomes a silent no-op when vibration is unavailable", () => {
    Object.defineProperty(global, "navigator", {
      configurable: true,
      value: {
        ...originalNavigator,
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)",
        platform: "MacIntel",
        maxTouchPoints: 0,
      },
    });

    expect(isHapticsSupported()).toBe(false);
    expect(triggerHaptic("error", { enabled: true, now: 1_000 })).toBe(false);
  });
});
