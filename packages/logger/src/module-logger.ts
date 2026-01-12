import type { Logger } from "pino";
import { parseLogConfig } from "./config";

export function createModuleLogger(
  rootLogger: Logger,
  moduleName: string,
): Logger {
  if (!moduleName || typeof moduleName !== "string") {
    throw new Error("Module name must be a non-empty string");
  }

  const config = parseLogConfig();
  const moduleLevel = config.modules[moduleName.toLowerCase()];
  const child = rootLogger.child({ module: moduleName });

  if (moduleLevel && moduleLevel !== config.default) {
    child.level = moduleLevel;
  }

  return child;
}
