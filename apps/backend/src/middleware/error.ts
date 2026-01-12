import type { Context } from "hono";
import process from "node:process";
import { appLogger } from "@totem/logger";

export async function errorHandler(err: Error, c: Context) {
  appLogger.error(
    { err, path: c.req.path, method: c.req.method },
    "Unhandled error",
  );

  const isDev = process.env.NODE_ENV !== "production";

  return c.json(
    {
      error: "Internal server error",
      message: isDev ? err.message : undefined,
      stack: isDev ? err.stack : undefined,
    },
    500,
  );
}
