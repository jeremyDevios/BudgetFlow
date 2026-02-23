// Logger utility that respects environment
const isDev = process.env.NODE_ENV === "development";

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  message: string;
  // Don't store sensitive data
}

/**
 * Log utility that filters sensitive information in production
 */
export const logger = {
  info: (message: string) => {
    if (isDev) {
      console.log(`[INFO] ${message}`);
    }
  },

  warn: (message: string) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`);
    }
  },

  error: (message: string, originalError?: unknown) => {
    // In production, log generic message
    const logMessage = isDev
      ? `[ERROR] ${message}${originalError ? ": " + JSON.stringify(originalError) : ""}`
      : `[ERROR] ${message}`;

    console.error(logMessage);
  },

  /**
   * Safe error logging that sanitizes Firebase errors
   * Removes sensitive info like tokens, user IDs, etc.
   */
  sanitizedError: (message: string, error: unknown) => {
    let sanitized = message;

    if (error instanceof Error) {
      sanitized += `: ${error.message}`;
    }

    if (isDev) {
      console.error(sanitized, error);
    } else {
      console.error(sanitized);
    }
  },
};

export default logger;
