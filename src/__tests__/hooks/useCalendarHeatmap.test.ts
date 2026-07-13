import { renderHook, waitFor } from "@testing-library/react";

import { useCalendarHeatmap } from "@/hooks/useCalendarHeatmap";

const collectionMock = jest.fn<unknown, any[]>(() => ({ type: "collection" }));
const documentIdMock = jest.fn(() => "__name__");
const onSnapshotMock = jest.fn();
const queryMock = jest.fn<unknown, any[]>(() => ({ type: "query" }));
const whereMock = jest.fn<unknown, any[]>((...args: unknown[]) => ({ type: "where", args }));

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
  },
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: any[]) => collectionMock(...args),
  documentId: () => documentIdMock(),
  onSnapshot: (...args: any[]) => onSnapshotMock(...args),
  query: (...args: any[]) => queryMock(...args),
  where: (...args: any[]) => whereMock(...args),
}));

// Helper to drive onSnapshot synchronously in tests.
type SnapshotDoc = { id: string; data: () => { loggedIn?: boolean } };
type SnapshotCallback = (snapshot: {
  forEach: (cb: (doc: SnapshotDoc) => void) => void;
}) => void;

describe("useCalendarHeatmap", () => {
  beforeEach(() => {
    collectionMock.mockClear();
    documentIdMock.mockClear();
    onSnapshotMock.mockClear();
    queryMock.mockClear();
    whereMock.mockClear();
  });

  it("loads login days from dailyActivity document IDs", async () => {
    const unsubscribe = jest.fn();

    onSnapshotMock.mockImplementation((_: unknown, onNext: SnapshotCallback) => {
      onNext({
        forEach: (callback) => {
          callback({ id: "2026-04-02", data: () => ({ loggedIn: true }) });
          callback({ id: "2026-04-03", data: () => ({ loggedIn: false }) });
          callback({ id: "2026-04-04", data: () => ({}) });
          callback({ id: "2026-04-05", data: () => ({ loggedIn: true, date: "1999-01-01" }) });
        },
      });
      return unsubscribe;
    });

    const { result, unmount } = renderHook(() =>
      useCalendarHeatmap("user-1", new Date("2026-04-17T12:00:00"))
    );

    await waitFor(() =>
      expect(result.current.loginDates).toEqual(new Set(["2026-04-02", "2026-04-05"]))
    );

    expect(documentIdMock).toHaveBeenCalledTimes(2);
    expect(whereMock).toHaveBeenNthCalledWith(1, "__name__", ">=", "2026-04-01");
    expect(whereMock).toHaveBeenNthCalledWith(2, "__name__", "<=", "2026-04-31");

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("returns an empty set and loading=false when userId is null", async () => {
    const { result } = renderHook(() =>
      useCalendarHeatmap(null, new Date("2026-04-17T12:00:00"))
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loginDates.size).toBe(0);
    expect(onSnapshotMock).not.toHaveBeenCalled();
  });

  it("calls unsubscribe and re-subscribes when monthDate changes", async () => {
    const unsubscribe1 = jest.fn();
    const unsubscribe2 = jest.fn();
    let callCount = 0;

    onSnapshotMock.mockImplementation((_: unknown, onNext: SnapshotCallback) => {
      onNext({ forEach: () => {} });
      callCount++;
      return callCount === 1 ? unsubscribe1 : unsubscribe2;
    });

    const { rerender, unmount } = renderHook(
      ({ date }: { date: Date }) => useCalendarHeatmap("user-1", date),
      { initialProps: { date: new Date("2026-04-01T12:00:00") } }
    );

    await waitFor(() => expect(onSnapshotMock).toHaveBeenCalledTimes(1));

    rerender({ date: new Date("2026-05-01T12:00:00") });

    await waitFor(() => expect(onSnapshotMock).toHaveBeenCalledTimes(2));
    expect(unsubscribe1).toHaveBeenCalledTimes(1);

    unmount();
    expect(unsubscribe2).toHaveBeenCalledTimes(1);
  });

  it("handles Firestore errors gracefully and resets to empty state", async () => {
    const loggerWarn = jest.requireMock("@/lib/logger").logger.warn as jest.Mock;
    loggerWarn.mockClear();

    onSnapshotMock.mockImplementation(
      (_: unknown, _onNext: unknown, onError: (err: Error) => void) => {
        onError(new Error("permission-denied"));
        return jest.fn();
      }
    );

    const { result } = renderHook(() =>
      useCalendarHeatmap("user-1", new Date("2026-04-17T12:00:00"))
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loginDates.size).toBe(0);
    expect(loggerWarn).toHaveBeenCalledWith("Failed to load calendar heatmap activity");
  });
});

