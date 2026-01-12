import {
  clearHeldMessages,
  getAggregatedHeldMessages,
} from "./held-messages.ts";
import { handleMessage } from "./handler/index.ts";
import { conversationLogger } from "@totem/logger";

/**
 * Process all held messages from maintenance mode
 */
export async function processHeldMessages(): Promise<{
  usersProcessed: number;
  messagesProcessed: number;
  errors: number;
}> {
  const aggregatedGroups = getAggregatedHeldMessages();

  if (aggregatedGroups.length === 0) {
    conversationLogger.info("No held messages to process");
    return { usersProcessed: 0, messagesProcessed: 0, errors: 0 };
  }

  conversationLogger.info(
    { count: aggregatedGroups.length },
    "Processing held messages from users",
  );

  const processedIds: number[] = [];
  let errorCount = 0;

  for (const group of aggregatedGroups) {
    try {
      conversationLogger.debug(
        { phoneNumber: group.phone_number, count: group.message_count },
        "Processing held messages for user",
      );

      await handleMessage({
        phoneNumber: group.phone_number,
        content: group.aggregated_text,
        timestamp: group.oldest_timestamp,
        messageId: group.latest_message_id,
      });

      // Track IDs for cleanup
      const ids = group.message_ids.split(",").map((id) => parseInt(id, 10));
      processedIds.push(...ids);
      conversationLogger.debug(
        { phoneNumber: group.phone_number, messageIds: ids },
        "Processed held messages for user",
      );
    } catch (error) {
      errorCount++;
      conversationLogger.error(
        { error, phoneNumber: group.phone_number },
        "Failed to process held messages for user",
      );
      // Continue with next user, don't mark failed ones as processed
    }
  }

  // Clear successfully processed messages
  if (processedIds.length > 0) {
    clearHeldMessages(processedIds);
  }

  const result = {
    usersProcessed: aggregatedGroups.length - errorCount,
    messagesProcessed: processedIds.length,
    errors: errorCount,
  };

  conversationLogger.info(result, "Held messages processing completed");

  return result;
}
