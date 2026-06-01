import { maskAmount } from "@/lib/maskAmount";

describe("maskAmount", () => {
  it("formats the real amount when anonymous mode is disabled", () => {
    expect(
      maskAmount({
        amount: 1234.56,
        currency: "USD",
        locale: "en-US",
      }),
    ).toBe("$1,234.56");
  });

  it("masks the numeric portion while preserving a leading currency symbol", () => {
    expect(
      maskAmount({
        amount: 1234.56,
        currency: "USD",
        locale: "en-US",
        anonymousMode: true,
      }),
    ).toBe("$••••");
  });

  it("masks the numeric portion while preserving a trailing currency symbol", () => {
    expect(
      maskAmount({
        amount: 1234.56,
        currency: "EUR",
        locale: "fr-FR",
        anonymousMode: true,
      }),
    ).toBe("•••• €");
  });

  it("preserves currency code placement when requested", () => {
    expect(
      maskAmount({
        amount: 1234.56,
        currency: "USD",
        locale: "fr-FR",
        anonymousMode: true,
        currencyDisplay: "code",
      }),
    ).toBe("•••• USD");
  });
});
