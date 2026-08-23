import {
  MATERIALIZED_MONTHS_AHEAD,
  monthKey,
  previousMonthKey,
  nextMonthKeys,
  nominalAnchorDay,
  occurrenceDate,
  endOfMonthIso,
  firestoreDocumentId,
  missingMonthKeys,
  requiresDeletionConfirmation,
} from "@/lib/recurrence";

describe("monthKey", () => {
  it("extracts the YYYY-MM key from an ISO string", () => {
    expect(monthKey("2026-08-23T12:30:00.000Z")).toBe("2026-08");
  });

  it("handles year boundaries", () => {
    expect(monthKey("2027-01-01T00:00:00.000Z")).toBe("2027-01");
  });

  it("derives the key from a Date object", () => {
    expect(monthKey(new Date(2026, 7, 23))).toBe("2026-08");
  });

  it("falls back to Date parsing for malformed strings", () => {
    expect(monthKey("not-a-date")).not.toBe("");
  });
});

describe("previousMonthKey", () => {
  it("returns the previous month", () => {
    expect(previousMonthKey("2026-08")).toBe("2026-07");
  });

  it("wraps across year boundaries", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });
});

describe("nextMonthKeys", () => {
  it("returns the following months, wrapping across years", () => {
    expect(nextMonthKeys("2026-11", 3)).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("returns an empty array for a zero count", () => {
    expect(nextMonthKeys("2026-08", 0)).toEqual([]);
  });

  it("pads single-digit months", () => {
    expect(nextMonthKeys("2026-01", 2)).toEqual(["2026-02", "2026-03"]);
  });
});

describe("nominalAnchorDay", () => {
  it("returns the day of month of the date", () => {
    expect(nominalAnchorDay("2026-08-31T10:00:00.000Z")).toBe(31);
    expect(nominalAnchorDay("2026-08-01T10:00:00.000Z")).toBe(1);
  });
});

describe("occurrenceDate", () => {
  it("clamps the 31st to the last real day of February (non-leap)", () => {
    expect(occurrenceDate(31, "2026-02")).toBe("2026-02-28T00:00:00.000Z");
  });

  it("clamps the 31st to the 29th in a leap-year February", () => {
    expect(occurrenceDate(31, "2028-02")).toBe("2028-02-29T00:00:00.000Z");
  });

  it("clamps the 30th to the last day of February", () => {
    expect(occurrenceDate(30, "2026-02")).toBe("2026-02-28T00:00:00.000Z");
  });

  it("returns to the anchor day on a 31-day month", () => {
    expect(occurrenceDate(31, "2026-03")).toBe("2026-03-31T00:00:00.000Z");
  });

  it("keeps normal days as-is", () => {
    expect(occurrenceDate(15, "2026-08")).toBe("2026-08-15T00:00:00.000Z");
  });

  it("never produces an invalid day (anchor 0 or negative clamped to 1)", () => {
    expect(occurrenceDate(0, "2026-08")).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("endOfMonthIso", () => {
  it("returns the last millisecond of the month", () => {
    expect(endOfMonthIso("2026-02")).toBe("2026-02-28T23:59:59.999Z");
    expect(endOfMonthIso("2026-08")).toBe("2026-08-31T23:59:59.999Z");
  });
});

describe("firestoreDocumentId", () => {
  it("produces the deterministic <recurrenceId>_<YYYY-MM> id", () => {
    expect(firestoreDocumentId("rid-123", "2026-09")).toBe("rid-123_2026-09");
  });
});

describe("missingMonthKeys", () => {
  it("materializes exactly MATERIALIZED_MONTHS_AHEAD months after the current month", () => {
    expect(missingMonthKeys("2026-08", "2026-11")).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(missingMonthKeys("2026-08", "2026-11").length).toBe(
      MATERIALIZED_MONTHS_AHEAD,
    );
  });

  it("catches up from a backdated first expense up to the horizon", () => {
    // First expense in M-3 → M-2, M-1, current month AND the 3 ahead (6 months).
    expect(missingMonthKeys("2026-05", "2026-11")).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });

  it("returns nothing when the tail already sits in the target month", () => {
    expect(missingMonthKeys("2026-11", "2026-11")).toEqual([]);
  });

  it("never generates before the tail (no retroactivity)", () => {
    expect(missingMonthKeys("2026-12", "2026-11")).toEqual([]);
  });

  it("wraps across year boundaries", () => {
    expect(missingMonthKeys("2026-11", "2027-02")).toEqual([
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
  });
});

describe("requiresDeletionConfirmation", () => {
  const now = new Date(2026, 7, 15); // 15 août 2026

  it("requires confirmation for a current-month recurring occurrence", () => {
    expect(
      requiresDeletionConfirmation("2026-08-10T00:00:00.000Z", true, now),
    ).toBe(true);
  });

  it("requires confirmation for a future-month recurring occurrence", () => {
    expect(
      requiresDeletionConfirmation("2026-09-10T00:00:00.000Z", true, now),
    ).toBe(true);
  });

  it("does not require confirmation for a past occurrence", () => {
    expect(
      requiresDeletionConfirmation("2026-07-10T00:00:00.000Z", true, now),
    ).toBe(false);
  });

  it("never requires confirmation for plain transactions", () => {
    expect(
      requiresDeletionConfirmation("2026-08-10T00:00:00.000Z", false, now),
    ).toBe(false);
  });
});
