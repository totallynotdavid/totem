import pino from "pino";
import type { Logger, LoggerOptions } from "pino";
import path from "node:path";
import process from "node:process";

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const IS_DEV = process.env.NODE_ENV === "development";

// Base configuration for all loggers
const baseConfig: LoggerOptions = {
  level: LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
};

/**
 * Creates a logger instance with the given name and optional file output
 *
 * @param name - Logger name (will appear in logs)
 * @param options - Optional configuration
 * @param options.filename - Optional filename for file logging (relative to data/logs/)
 * @param options.dataPath - Optional data directory path (default: ./data)
 * @returns Pino logger instance
 */
export function createLogger(
  name: string,
  options?: {
    filename?: string;
    dataPath?: string;
  },
): Logger {
  const dataPath = options?.dataPath || "./data";

  if (IS_DEV) {
    // Development: pretty console output + optional file
    const targets: Array<{
      target: string;
      level: string;
      options?: Record<string, unknown>;
    }> = [
      {
        target: "pino-pretty",
        level: LOG_LEVEL,
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
        },
      },
    ];

    // Add file target if filename specified
    if (options?.filename) {
      targets.push({
        target: "pino/file",
        level: LOG_LEVEL,
        options: {
          destination: path.join(dataPath, "logs", options.filename),
          mkdir: true,
        },
      });
    }

    return pino({
      ...baseConfig,
      name,
      transport: { targets },
    });
  }

  // Production: JSON to file (or stdout if no filename)
  if (options?.filename) {
    return pino(
      { ...baseConfig, name },
      pino.destination({
        dest: path.join(dataPath, "logs", options.filename),
        sync: false,
        mkdir: true,
      }),
    );
  }

  // No file specified - just use stdout
  return pino({ ...baseConfig, name });
}

// Domain-specific loggers for apps/backend
export const appLogger = createLogger("app", { filename: "app.log" });
export const requestLogger = createLogger("request", {
  filename: "requests.log",
});
export const conversationLogger = createLogger("conversation", {
  filename: "conversations.log",
});
export const eligibilityLogger = createLogger("eligibility", {
  filename: "eligibility.log",
});
export const orderLogger = createLogger("order", { filename: "orders.log" });

// Export types for convenience
export type { Logger } from "pino";
