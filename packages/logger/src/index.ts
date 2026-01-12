import pino from "pino";
import type { Logger, LoggerOptions } from "pino";
import process from "node:process";

export function parseLogConfig(): {
  default: string;
  modules: Record<string, string>;
} {
  const config = {
    default: process.env.LOG_LEVEL || "info",
    modules: {} as Record<string, string>,
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("LOG_LEVEL_") && value) {
      const moduleName = key.replace("LOG_LEVEL_", "").toLowerCase();
      config.modules[moduleName] = value;
    }
  }

  return config;
}

export interface LoggerConfig {
  name: string;
  logDir: string;
  filename?: string;
  isDevelopment?: boolean;
  baseLevel?: string;
}

export function createRootLogger(config: LoggerConfig): Logger {
  const isDev = config.isDevelopment ?? process.env.NODE_ENV === "development";
  const level = config.baseLevel || parseLogConfig().default;

  const baseConfig: LoggerOptions = {
    level,
    name: config.name,
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (isDev) {
    // Dev: pretty console + JSON file
    const targets: any[] = [
      {
        target: "pino-pretty",
        level,
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname",
        },
      },
    ];

    if (config.filename) {
      targets.push({
        target: "pino/file",
        level,
        options: {
          destination: `${config.logDir}/${config.filename}`,
          mkdir: true,
        },
      });
    }

    return pino({ ...baseConfig, transport: { targets } });
  }

  // Production: JSON to file or stdout
  if (config.filename) {
    return pino(
      baseConfig,
      pino.destination({
        dest: `${config.logDir}/${config.filename}`,
        sync: false,
        mkdir: true,
      }),
    );
  }

  return pino(baseConfig);
}

export function createModuleLogger(
  rootLogger: Logger,
  moduleName: string,
): Logger {
  const config = parseLogConfig();
  const moduleLevel = config.modules[moduleName.toLowerCase()];

  const child = rootLogger.child({ module: moduleName });

  if (moduleLevel && moduleLevel !== config.default) {
    child.level = moduleLevel;
  }

  return child;
}

export type { Logger } from "pino";
