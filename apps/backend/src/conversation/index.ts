/**
 * Conversation Module
 *
 * New architecture entry point for handling WhatsApp conversations.
 */

export { handleMessage, type IncomingMessage } from "./handler.ts";
export { messageAggregator } from "./aggregator.ts";
export {
  getOrCreateConversation,
  updateConversation,
  escalateConversation,
  resetSession,
  isSessionTimedOut,
} from "./store.ts";
