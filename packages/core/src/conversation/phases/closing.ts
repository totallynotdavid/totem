/**
 * Closing phase transition
 *
 * Terminal state - conversation has ended (purchase confirmed or not)
 */

import type { TransitionResult } from "../types.ts";

export function transitionClosing(): TransitionResult {
  // Closing is terminal - don't respond to new messages
  // A new message will trigger session reset in the handler
  return { type: "stay" };
}
