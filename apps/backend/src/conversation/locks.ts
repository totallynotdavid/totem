/**
 * Makes sure that messages from the same user are processed sequentially,
 * while allowing messages from different users to be processed in parallel.
 */

import { createLogger } from "../lib/logger.ts";
import { TIMEOUTS } from "../config/timeouts.ts";

const logger = createLogger("locks");

type LockEntry = {
  promise: Promise<void>;
  resolve: () => void;
  acquiredAt: number;
  phoneNumber: string;
};

const locks = new Map<string, LockEntry>();

/**
 * Acquire a lock for a user. Returns when the lock is acquired.
 */
export async function acquireLock(phoneNumber: string): Promise<void> {
  // Wait for any existing lock
  const existing = locks.get(phoneNumber);
  if (existing) {
    logger.debug({ phoneNumber }, "Waiting for lock");
    await existing.promise;
  }

  // Create new lock
  let resolve: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });

  locks.set(phoneNumber, {
    promise,
    resolve: resolve!,
    acquiredAt: Date.now(),
    phoneNumber,
  });

  logger.debug({ phoneNumber }, "Lock acquired");
}

/**
 * Release the lock for a user
 */
export function releaseLock(phoneNumber: string): void {
  const entry = locks.get(phoneNumber);
  if (entry) {
    const duration = Date.now() - entry.acquiredAt;
    locks.delete(phoneNumber);
    entry.resolve();
    logger.debug({ phoneNumber, durationMs: duration }, "Lock released");

    if (duration > 10_000) {
      logger.warn(
        { phoneNumber, durationMs: duration },
        "Lock held for unusually long time",
      );
    }
  }
}

/**
 * Execute a function with the user lock held
 *
 * @param phoneNumber - User phone number (lock key)
 * @param fn - Function to execute with lock held
 * @param timeoutMs - Timeout in milliseconds (default: 30s)
 * @returns Result of fn()
 * @throws Error if timeout exceeded
 */
export async function withLock<T>(
  phoneNumber: string,
  fn: () => Promise<T>,
  timeoutMs: number = TIMEOUTS.LOCK_DEFAULT,
): Promise<T> {
  await acquireLock(phoneNumber);

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Lock timeout for ${phoneNumber} after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Lock timeout")) {
      logger.error(
        { error, phoneNumber, timeoutMs },
        "Lock timeout exceeded - possible stuck operation",
      );
    }
    throw error;
  } finally {
    releaseLock(phoneNumber);
  }
}

export function getLockStatus(): {
  activeLocksCount: number;
  locks: Array<{ phoneNumber: string; heldForMs: number }>;
} {
  const now = Date.now();
  const lockList = Array.from(locks.values()).map((entry) => ({
    phoneNumber: entry.phoneNumber,
    heldForMs: now - entry.acquiredAt,
  }));

  return {
    activeLocksCount: locks.size,
    locks: lockList,
  };
}

export function cleanupStaleLocks(maxAgeMs: number = 5 * 60_000): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [phoneNumber, entry] of locks.entries()) {
    const age = now - entry.acquiredAt;
    if (age > maxAgeMs) {
      logger.warn(
        { phoneNumber, ageMs: age },
        "Cleaning up stale lock - possible leaked lock",
      );
      locks.delete(phoneNumber);
      entry.resolve(); // Release any waiters
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info({ cleaned }, "Cleaned up stale locks");
  }

  return cleaned;
}
