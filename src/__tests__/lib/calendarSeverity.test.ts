import {
  computeSpendSeverity,
  computeSpendSeverityFromEnvelopes,
} from "@/lib/calendarSeverity";

describe("computeSpendSeverity", () => {
  describe("no spend → login-only", () => {
    it("returns login-only when spend is zero regardless of budget", () => {
      expect(computeSpendSeverity(0, 1000)).toBe("login-only");
    });

    it("returns login-only when spend is negative (guard)", () => {
      expect(computeSpendSeverity(-5, 1000)).toBe("login-only");
    });

    it("returns login-only when both spend and budget are zero", () => {
      expect(computeSpendSeverity(0, 0)).toBe("login-only");
    });
  });

  describe("zero budget with spend → heavy-spend", () => {
    it("returns heavy-spend when budget is 0 and spend > 0", () => {
      expect(computeSpendSeverity(1, 0)).toBe("heavy-spend");
    });

    it("returns heavy-spend when budget is 0 and spend is large", () => {
      expect(computeSpendSeverity(500, 0)).toBe("heavy-spend");
    });
  });

  describe("low-spend (ratio <= 0.20)", () => {
    it("returns low-spend exactly at the 0.20 boundary", () => {
      // 200 / 1000 = 0.20 exactly → low-spend
      expect(computeSpendSeverity(200, 1000)).toBe("low-spend");
    });

    it("returns low-spend well below boundary", () => {
      // 50 / 1000 = 0.05
      expect(computeSpendSeverity(50, 1000)).toBe("low-spend");
    });

    it("returns low-spend at ratio = 0.01", () => {
      expect(computeSpendSeverity(10, 1000)).toBe("low-spend");
    });
  });

  describe("moderate-spend (0.20 < ratio <= 0.50)", () => {
    it("returns moderate-spend just above the low boundary", () => {
      // 201 / 1000 = 0.201
      expect(computeSpendSeverity(201, 1000)).toBe("moderate-spend");
    });

    it("returns moderate-spend exactly at the 0.50 boundary", () => {
      // 500 / 1000 = 0.50 → moderate-spend
      expect(computeSpendSeverity(500, 1000)).toBe("moderate-spend");
    });

    it("returns moderate-spend in the middle of the range", () => {
      // 350 / 1000 = 0.35
      expect(computeSpendSeverity(350, 1000)).toBe("moderate-spend");
    });
  });

  describe("heavy-spend (ratio > 0.50)", () => {
    it("returns heavy-spend just above the 0.50 boundary", () => {
      // 501 / 1000 = 0.501
      expect(computeSpendSeverity(501, 1000)).toBe("heavy-spend");
    });

    it("returns heavy-spend for ratio = 1.0 (full budget in one day)", () => {
      expect(computeSpendSeverity(1000, 1000)).toBe("heavy-spend");
    });

    it("returns heavy-spend when spend exceeds budget", () => {
      expect(computeSpendSeverity(1500, 1000)).toBe("heavy-spend");
    });
  });

  describe("real-world fractional budgets", () => {
    it("handles floating point budgets correctly", () => {
      // 80.50 / 500.00 = 0.161 → low-spend
      expect(computeSpendSeverity(80.5, 500)).toBe("low-spend");
    });

    it("handles small fractional amounts", () => {
      // 0.01 / 2000 = 0.000005 → low-spend
      expect(computeSpendSeverity(0.01, 2000)).toBe("low-spend");
    });

    it("correctly splits low and moderate with a 2000 budget", () => {
      // boundary: 400 = 0.20 → low, 401 → moderate
      expect(computeSpendSeverity(400, 2000)).toBe("low-spend");
      expect(computeSpendSeverity(400.01, 2000)).toBe("moderate-spend");
    });

    it("correctly splits moderate and heavy with a 2000 budget", () => {
      // boundary: 1000 = 0.50 → moderate, 1000.01 → heavy
      expect(computeSpendSeverity(1000, 2000)).toBe("moderate-spend");
      expect(computeSpendSeverity(1000.01, 2000)).toBe("heavy-spend");
    });
  });
});

describe("computeSpendSeverityFromEnvelopes", () => {
  it("returns login-only for empty array", () => {
    expect(computeSpendSeverityFromEnvelopes([])).toBe("login-only");
  });

  it("returns login-only when all entries have spend = 0", () => {
    expect(
      computeSpendSeverityFromEnvelopes([
        { spend: 0, budget: 200 },
        { spend: 0, budget: 500 },
      ])
    ).toBe("login-only");
  });

  it("returns heavy-spend when any envelope has budget = 0 and spend > 0", () => {
    expect(computeSpendSeverityFromEnvelopes([{ spend: 50, budget: 0 }])).toBe(
      "heavy-spend"
    );
  });

  it("uses worst ratio - 245EUR on 120EUR envelope is heavy-spend", () => {
    expect(computeSpendSeverityFromEnvelopes([{ spend: 245, budget: 120 }])).toBe(
      "heavy-spend"
    );
  });

  it("uses worst ratio across multiple envelopes", () => {
    // 10% and 60% -> worst = 60% -> heavy
    expect(
      computeSpendSeverityFromEnvelopes([
        { spend: 10, budget: 100 },
        { spend: 60, budget: 100 },
      ])
    ).toBe("heavy-spend");
  });

  it("ignores entries with spend = 0 when computing worst ratio", () => {
    expect(
      computeSpendSeverityFromEnvelopes([
        { spend: 0, budget: 100 },
        { spend: 18, budget: 100 },
      ])
    ).toBe("low-spend");
  });

  it("ratio exactly 0.20 -> low-spend", () => {
    expect(computeSpendSeverityFromEnvelopes([{ spend: 20, budget: 100 }])).toBe(
      "low-spend"
    );
  });

  it("ratio 0.201 -> moderate-spend", () => {
    expect(
      computeSpendSeverityFromEnvelopes([{ spend: 20.1, budget: 100 }])
    ).toBe("moderate-spend");
  });

  it("ratio exactly 0.50 -> moderate-spend", () => {
    expect(computeSpendSeverityFromEnvelopes([{ spend: 50, budget: 100 }])).toBe(
      "moderate-spend"
    );
  });

  it("ratio 0.501 -> heavy-spend", () => {
    expect(
      computeSpendSeverityFromEnvelopes([{ spend: 50.1, budget: 100 }])
    ).toBe("heavy-spend");
  });

  it("250EUR on 500EUR envelope -> 50% -> moderate-spend", () => {
    expect(computeSpendSeverityFromEnvelopes([{ spend: 250, budget: 500 }])).toBe(
      "moderate-spend"
    );
  });

  it("200EUR on 1000EUR envelope -> 20% -> low-spend", () => {
    expect(
      computeSpendSeverityFromEnvelopes([{ spend: 200, budget: 1000 }])
    ).toBe("low-spend");
  });
});
