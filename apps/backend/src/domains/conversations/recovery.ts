import { createLogger } from "../../lib/logger.ts";
import type { RecoveryResult } from "./recovery/types.ts";
import { getStuckConversations } from "./recovery/store.ts";
import { processConversation } from "./recovery/processor.ts";

export { countWaitingForRecovery } from "./recovery/store.ts";

const logger = createLogger("recovery");

/**
 * Retries eligibility checks for all conversations stuck in waiting_for_recovery.
 */
export async function retryStuckEligibilityChecks(): Promise<RecoveryResult> {
  const stuckConversations = getStuckConversations();
  logger.info(
    { count: stuckConversations.length },
    "Starting recovery of stuck conversations",
  );

  const stats = { recoveredCount: 0, stillFailingCount: 0, errors: 0 };

  for (const row of stuckConversations) {
    await processConversation(row, stats);
  }

  return stats;
}
