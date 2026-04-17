import { renderHook, waitFor } from "@testing-library/react";

import { useCalendarHeatmap } from "@/hooks/useCalendarHeatmap";

const collectionMock = jest.fn(() => ({ type: "collection" }));
const documentIdMock = jest.fn(() => "__name__");
const onSnapshotMock = jest.fn();
const queryMock = jest.fn(() => ({ type: "query" }));
const whereMock = jest.fn((...args: unknown[]) => ({ type: "where", args }));

jest.mock("@/lib/firebase", () => ({
  db: {},
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    warn: jest.fn(),
  },
}));

jest.mock("firebase/firestore", () => ({
  collection: (...args: unknown[]) => collectionMock(...args),
  documentId: () => documentIdMock(),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
}));

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

    onSnapshotMock.mockImplementation((_, onNext: (snapshot: {
      forEach: (callback: (doc: { id: string; data: () => { loggedIn?: boolean } }) => void) => void;
    }) => void) => {
      onNext({
        forEach: (callback) => {
          callback({
            id: "2026-04-02",
            data: () => ({ loggedIn: true }),
          });
          callback({
            id: "2026-04-03",
            data: () => ({ loggedIn: false }),
          });
          callback({
            id: "2026-04-04",
            data: () => ({}),
          });
          callback({
            id: "2026-04-05",
            data: () => ({ loggedIn: true, date: "1999-01-01" }),
          });
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
});
