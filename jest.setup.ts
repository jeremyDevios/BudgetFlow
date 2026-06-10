import '@testing-library/jest-dom';

// Global mock for CurrencyContext — provides EUR as default for all tests.
// Individual tests can override this mock if they need a different currency.
jest.mock("@/context/CurrencyContext", () => ({
  CurrencyProvider: ({ children }: { children: React.ReactNode }) => children,
  useCurrency: () => ({
    currency: "EUR",
    currencyReady: true,
    setCurrency: jest.fn(),
  }),
}));

// Global mock for AnonymousModeContext — provides default (disabled) for all tests.
// Individual tests can override this mock with their own jest.mock call.
jest.mock("@/context/AnonymousModeContext", () => ({
  AnonymousModeProvider: ({ children }: { children: React.ReactNode }) => children,
  useAnonymousMode: () => ({
    anonymousMode: false,
    anonymousModeReady: true,
    setAnonymousMode: jest.fn(),
  }),
}));
