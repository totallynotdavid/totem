import process from "node:process";

export interface LogConfig {
  default: string;
  modules: Record<string, string>;
}

export function parseLogConfig(): LogConfig {
  const config: LogConfig = {
    default: process.env.LOG_LEVEL || "info",
    modules: {},
  };

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("LOG_LEVEL_") && value) {
      const moduleName = key.replace("LOG_LEVEL_", "").toLowerCase();
      config.modules[moduleName] = value;
    }
  }

  return config;
}
