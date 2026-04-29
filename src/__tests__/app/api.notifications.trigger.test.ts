const mockSend = jest.fn();
const mockUpdate = jest.fn();
const mockRangeQueries: Array<{ userId: string; field: string; op: string; value: string }> = [];

let mockUsers: Array<{ id: string; data: () => Record<string, unknown> }> = [];
let mockTransactionsByUserId: Record<string, Array<Record<string, unknown>>> = {};

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/firebaseAdmin", () => ({
  adminDb: {
    collection: jest.fn((collectionName: string) => {
      if (collectionName !== "users") {
        throw new Error(`Unexpected collection: ${collectionName}`);
      }

      return {
        get: jest.fn().mockResolvedValue({
          size: mockUsers.length,
          docs: mockUsers,
        }),
        doc: jest.fn((userId: string) => ({
          update: mockUpdate,
          collection: jest.fn((subCollectionName: string) => {
            if (subCollectionName !== "transactions") {
              throw new Error(`Unexpected sub-collection: ${subCollectionName}`);
            }

            return {
              where: jest.fn((field: string, op: string, value: string) => {
                mockRangeQueries.push({ userId, field, op, value });

                return {
                  where: jest.fn((nextField: string, nextOp: string, nextValue: string) => {
                    mockRangeQueries.push({
                      userId,
                      field: nextField,
                      op: nextOp,
                      value: nextValue,
                    });

                    return {
                      get: jest.fn().mockResolvedValue({
                        forEach: (callback: (doc: { data: () => Record<string, unknown> }) => void) => {
                          for (const transaction of mockTransactionsByUserId[userId] ?? []) {
                            callback({
                              data: () => transaction,
                            });
                          }
                        },
                      }),
                    };
                  }),
                };
              }),
            };
          }),
        })),
      };
    }),
  },
  adminMessaging: {
    send: mockSend,
  },
}));

import { GET, POST } from "@/app/api/notifications/trigger/route";

function createMockRequest(url: string, secret?: string): Request {
  return {
    url,
    headers: {
      get: (name: string) => {
        if (name === "x-cron-secret") {
          return secret ?? null;
        }

        return null;
      },
    },
  } as Request;
}

describe("notifications trigger route", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-04-29T17:00:00.000Z"));
    process.env.CRON_SECRET = "test-secret";
    mockUsers = [];
    mockTransactionsByUserId = {};
    mockRangeQueries.length = 0;
    mockSend.mockReset();
    mockUpdate.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("rejects unauthorized requests", async () => {
    const response = await GET(createMockRequest("http://localhost/api/notifications/trigger"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: "Unauthorized" });
  });

  it("supports legacy GET requests with ?key and returns detailed stats", async () => {
    mockUsers = [
      {
        id: "user-1",
        data: () => ({
          notificationsEnabled: true,
          fcmToken: "token-1",
        }),
      },
      {
        id: "user-2",
        data: () => ({
          notificationsEnabled: false,
          fcmToken: "token-2",
        }),
      },
      {
        id: "user-3",
        data: () => ({
          notificationsEnabled: true,
          fcmToken: null,
        }),
      },
    ];

    mockTransactionsByUserId = {
      "user-1": [
        { amount: 10.5, date: "2026-04-29T08:00:00.000Z" },
        { amount: "4.5", date: "2026-04-29T12:00:00.000Z" },
      ],
    };

    mockSend.mockResolvedValue("message-id");

    const response = await GET(
      createMockRequest("http://localhost/api/notifications/trigger?key=test-secret")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      date: "2026-04-29",
      totalUsers: 3,
      eligibleUsers: 1,
      skippedDisabled: 1,
      skippedWithoutToken: 1,
      sent: 1,
    });

    expect(mockRangeQueries).toEqual([
      { userId: "user-1", field: "date", op: ">=", value: "2026-04-29" },
      { userId: "user-1", field: "date", op: "<=", value: "2026-04-29T23:59:59.999" },
    ]);

    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token-1",
        notification: expect.objectContaining({
          title: "Bilan Quotidien",
          body: expect.stringContaining("15.00€"),
        }),
      })
    );
  });

  it("supports POST requests with x-cron-secret and clears invalid tokens", async () => {
    mockUsers = [
      {
        id: "user-1",
        data: () => ({
          notificationsEnabled: true,
          fcmToken: "token-1",
        }),
      },
    ];

    mockTransactionsByUserId = {
      "user-1": [],
    };

    mockSend.mockRejectedValue({
      code: "messaging/registration-token-not-registered",
    });

    const response = await POST(
      createMockRequest("http://localhost/api/notifications/trigger", "test-secret")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      eligibleUsers: 1,
      sent: 0,
    });
    expect(mockUpdate).toHaveBeenCalledWith({ fcmToken: null });
  });
});
