import {
  groupTransactionsByMonth,
  fetchLinkedTransactions,
  migrateTransactionsToExisting,
  createEnvelopeAndMigrate,
  deleteEnvelopeAndTransactions,
  NewEnvelopeData,
} from "@/lib/envelopeService";
import { Transaction } from "@/types/transaction";

// ── Mock Firestore ───────────────────────────────────────────────────

const getDocsMock = jest.fn();
/* eslint-disable @typescript-eslint/no-explicit-any */
const writeBatchMock = {
  update: (jest.fn() as any).mockReturnThis(),
  delete: (jest.fn() as any).mockReturnThis(),
  commit: (jest.fn() as any).mockResolvedValue(undefined),
};
const writeBatchFnMock = jest.fn(() => writeBatchMock) as any;
const docMock = jest.fn() as any;
const collectionMock = jest.fn() as any;
const queryMock = jest.fn() as any;
const whereMock = jest.fn() as any;
const incrementMock = jest.fn((n: number) => `incr(${n})`);
const addDocMock = jest.fn() as any;
const serverTimestampMock = jest.fn(() => "server-timestamp");
/* eslint-enable @typescript-eslint/no-explicit-any */

jest.mock("firebase/firestore", () => ({
  collection: (...args: any[]) => collectionMock(...args),
  doc: (...args: any[]) => docMock(...args),
  getDocs: (...args: any[]) => getDocsMock(...args),
  addDoc: (...args: any[]) => addDocMock(...args),
  writeBatch: (...args: any[]) => writeBatchFnMock(...args),
  query: (...args: any[]) => queryMock(...args),
  where: (...args: any[]) => whereMock(...args),
  increment: (n: number) => incrementMock(n),
  serverTimestamp: () => serverTimestampMock(),
}));

jest.mock("@/lib/firebase", () => ({ db: {} }));

// ── Helpers ──────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    amount: 50,
    description: "Test",
    envelopeId: "env-src",
    date: "2026-06-15T12:00:00.000Z",
    isReimbursement: false,
    ...overrides,
  };
}

function makeSnapshot(docs: Array<{ id: string; data: () => Record<string, unknown> }>) {
  const forEach = (cb: (d: typeof docs[number]) => void) => docs.forEach(cb);
  return { forEach, docs };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests: groupTransactionsByMonth ──────────────────────────────────

describe("groupTransactionsByMonth", () => {
  it("returns empty array for no transactions", () => {
    expect(groupTransactionsByMonth([])).toEqual([]);
  });

  it("groups a single transaction by its month", () => {
    const txs = [makeTx({ date: "2026-06-15" })];
    expect(groupTransactionsByMonth(txs)).toEqual([
      { month: "2026-06", count: 1 },
    ]);
  });

  it("groups multiple transactions in the same month", () => {
    const txs = [
      makeTx({ id: "tx-1", date: "2026-06-01" }),
      makeTx({ id: "tx-2", date: "2026-06-20" }),
      makeTx({ id: "tx-3", date: "2026-06-30" }),
    ];
    expect(groupTransactionsByMonth(txs)).toEqual([
      { month: "2026-06", count: 3 },
    ]);
  });

  it("groups transactions across multiple months sorted chronologically", () => {
    const txs = [
      makeTx({ id: "tx-1", date: "2026-07-01" }),
      makeTx({ id: "tx-2", date: "2026-04-15" }),
      makeTx({ id: "tx-3", date: "2026-04-20" }),
      makeTx({ id: "tx-4", date: "2026-01-01" }),
    ];
    expect(groupTransactionsByMonth(txs)).toEqual([
      { month: "2026-01", count: 1 },
      { month: "2026-04", count: 2 },
      { month: "2026-07", count: 1 },
    ]);
  });

  it("handles date strings with time component", () => {
    const txs = [
      makeTx({ id: "tx-1", date: "2026-06-15T12:00:00.000Z" }),
      makeTx({ id: "tx-2", date: "2026-07-03T23:59:59.999Z" }),
    ];
    expect(groupTransactionsByMonth(txs)).toEqual([
      { month: "2026-06", count: 1 },
      { month: "2026-07", count: 1 },
    ]);
  });
});

// ── Tests: fetchLinkedTransactions ───────────────────────────────────

describe("fetchLinkedTransactions", () => {
  it("returns an empty array when no transactions are linked", async () => {
    getDocsMock.mockResolvedValueOnce(makeSnapshot([]));

    const result = await fetchLinkedTransactions("user-1", "env-src");
    expect(result).toEqual([]);
  });

  it("returns sorted transactions (newest first)", async () => {
    getDocsMock.mockResolvedValueOnce(
      makeSnapshot([
        {
          id: "tx-1",
          data: () => ({
            amount: 50,
            description: "Older",
            envelopeId: "env-src",
            date: "2026-01-01T00:00:00.000Z",
          }),
        },
        {
          id: "tx-2",
          data: () => ({
            amount: 100,
            description: "Newer",
            envelopeId: "env-src",
            date: "2026-06-15T00:00:00.000Z",
          }),
        },
      ]),
    );

    const result = await fetchLinkedTransactions("user-1", "env-src");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("tx-2"); // newer first
    expect(result[1].id).toBe("tx-1");
  });
});

// ── Tests: migrateTransactionsToExisting ─────────────────────────────

describe("migrateTransactionsToExisting", () => {
  it("updates all transactions and deletes the source envelope", async () => {
    getDocsMock.mockResolvedValueOnce(
      makeSnapshot([
        {
          id: "tx-1",
          data: () => ({
            amount: 50,
            description: "A",
            envelopeId: "env-src",
            date: "2026-06-01",
          }),
        },
        {
          id: "tx-2",
          data: () => ({
            amount: 30,
            description: "B",
            envelopeId: "env-src",
            date: "2026-06-02",
          }),
        },
      ]),
    );

    await migrateTransactionsToExisting("user-1", "env-src", "env-target");

    // Should have committed the batch
    expect(writeBatchMock.commit).toHaveBeenCalled();

    // Both transactions should be updated
    expect(writeBatchMock.update).toHaveBeenCalledTimes(3); // 2 tx updates + 1 counter

    // Source envelope should be deleted
    expect(writeBatchMock.delete).toHaveBeenCalled();
  });

  it("handles an envelope with zero transactions", async () => {
    getDocsMock.mockResolvedValueOnce(makeSnapshot([]));

    await migrateTransactionsToExisting("user-1", "env-src", "env-target");

    expect(writeBatchMock.commit).toHaveBeenCalled();
    expect(writeBatchMock.delete).toHaveBeenCalled();
  });
});

// ── Tests: createEnvelopeAndMigrate ──────────────────────────────────

describe("createEnvelopeAndMigrate", () => {
  const newEnvData: NewEnvelopeData = {
    name: "Nouvelle",
    budget: 200,
    icon: "ShoppingCart",
    color: "bg-blue-500",
  };

  it("creates a new envelope, migrates, and deletes source", async () => {
    addDocMock.mockResolvedValueOnce({ id: "env-new" });
    getDocsMock.mockResolvedValueOnce(
      makeSnapshot([
        {
          id: "tx-1",
          data: () => ({
            amount: 50,
            description: "Test",
            envelopeId: "env-src",
            date: "2026-06-01",
          }),
        },
      ]),
    );

    const newId = await createEnvelopeAndMigrate(
      "user-1",
      "env-src",
      newEnvData,
    );

    expect(newId).toBe("env-new");
    expect(addDocMock).toHaveBeenCalled();
    expect(writeBatchMock.commit).toHaveBeenCalled();
    expect(writeBatchMock.delete).toHaveBeenCalled();
  });

  it("handles zero transactions", async () => {
    addDocMock.mockResolvedValueOnce({ id: "env-new" });
    getDocsMock.mockResolvedValueOnce(makeSnapshot([]));

    const newId = await createEnvelopeAndMigrate(
      "user-1",
      "env-src",
      newEnvData,
    );

    expect(newId).toBe("env-new");
    expect(writeBatchMock.delete).toHaveBeenCalled();
  });
});

// ── Tests: deleteEnvelopeAndTransactions ─────────────────────────────

describe("deleteEnvelopeAndTransactions", () => {
  it("deletes envelope, transactions, and updates counters", async () => {
    const txs: Transaction[] = [
      makeTx({ id: "tx-1", date: "2026-06-01" }),
      makeTx({ id: "tx-2", date: "2026-06-15" }),
      makeTx({ id: "tx-3", date: "2026-07-01" }),
    ];

    await deleteEnvelopeAndTransactions("user-1", "env-src", txs);

    expect(writeBatchMock.commit).toHaveBeenCalled();
    // 3 tx deletes + 1 envelope delete + counter update
    expect(writeBatchMock.delete).toHaveBeenCalledTimes(4);
    expect(writeBatchMock.update).toHaveBeenCalled();
  });

  it("handles empty transaction list", async () => {
    await deleteEnvelopeAndTransactions("user-1", "env-src", []);

    expect(writeBatchMock.commit).toHaveBeenCalled();
    expect(writeBatchMock.delete).toHaveBeenCalledTimes(1);
  });
});
