import { withLock } from "../locks.ts";

import {
  getOrCreateConversation,
  isSessionTimedOut,
  resetSession,
} from "../store.ts";
import { WhatsAppService } from "../../adapters/whatsapp/index.ts";
import { runEnrichmentLoop } from "./enrichment-loop.ts";
import { executeCommands } from "./command-executor.ts";
import { calculateResponseDelay } from "./response-timing.ts";
import { sleep } from "./sleep.ts";
import { conversationLogger } from "@totem/logger";
import { notifyTeam } from "../../adapters/notifier/client.ts";

export type IncomingMessage = {
  phoneNumber: string;
  content: string;
  timestamp: number; // WhatsApp message timestamp
  messageId: string;
};

/**
 * Handle an incoming message from WhatsApp.
 *
 * Orchestrates the complete message processing lifecycle:
 * 1. Acquire per-user lock for sequential processing
 * 2. Get/create conversation and check session timeout
 * 3. Mark message as read and show typing indicator
 * 4. Run enrichment loop to get final transition result
 * 5. Apply response delay for natural pacing
 * 6. Execute commands from state machine
 *
 * @param message - Incoming message details
 */
export async function handleMessage(message: IncomingMessage): Promise<void> {
  const { phoneNumber, content, timestamp, messageId } = message;

  await withLock(phoneNumber, async () => {
    conversationLogger.debug({ phoneNumber, messageId }, "Processing message");

    let conversation = getOrCreateConversation(phoneNumber);

    if (isSessionTimedOut(conversation.metadata)) {
      conversationLogger.info(
        { phoneNumber, lastCategory: conversation.metadata.lastCategory },
        "Session timed out, resetting",
      );
      resetSession(phoneNumber, conversation.metadata.lastCategory);
      conversation = getOrCreateConversation(phoneNumber);
      conversation.metadata.isReturningUser = true;
    }

    await WhatsAppService.markAsReadAndShowTyping(messageId);

    try {
      const result = await runEnrichmentLoop(
        conversation.phase,
        content,
        conversation.metadata,
        phoneNumber,
      );

      const delay = calculateResponseDelay(timestamp, Date.now());
      if (delay > 0) {
        await sleep(delay);
      }

      await executeCommands(
        result,
        phoneNumber,
        conversation.metadata,
        conversation.isSimulation,
      );
    } catch (error) {
      conversationLogger.error(
        { error, phoneNumber, messageId, phase: conversation.phase.phase },
        "Failed to process message",
      );

      await notifyTeam(
        "dev",
        `CRITICAL: Message processing failed for ${phoneNumber}\nPhase: ${conversation.phase.phase}\nError: ${error instanceof Error ? error.message : String(error)}`,
      ).catch(() => {});
    }
  });
}
