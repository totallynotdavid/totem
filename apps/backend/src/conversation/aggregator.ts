/**
 * Message Aggregator
 *
 * Accumulates messages from the same user within a quiet window,
 * then flushes them as a single aggregated message.
 *
 * This handles the "Hola" + "Quisiera un celular" pattern where
 * users send multiple messages in quick succession.
 */

type PendingMessage = {
  text: string;
  whatsappTimestamp: number; // Unix timestamp from WhatsApp (ms)
  messageId: string;
};

type FlushCallback = (
  aggregatedText: string,
  oldestWhatsappTimestamp: number,
  latestMessageId: string,
) => Promise<void>;

type PendingEntry = {
  messages: PendingMessage[];
  timeoutId: Timer;
  callback: FlushCallback;
};

const DEBOUNCE_WINDOW_MS = 3000; // Wait 3s of quiet before processing

const pending = new Map<string, PendingEntry>();

/**
 * Add a message for aggregation with inline callback
 */
function add(
  phoneNumber: string,
  text: string,
  whatsappTimestamp: number,
  messageId: string,
  callback: FlushCallback,
): void {
  const message: PendingMessage = {
    text,
    whatsappTimestamp,
    messageId,
  };

  const existing = pending.get(phoneNumber);

  if (existing) {
    // Clear previous timeout, add message, reset timer
    clearTimeout(existing.timeoutId);
    existing.messages.push(message);
    existing.timeoutId = setTimeout(
      () => flush(phoneNumber),
      DEBOUNCE_WINDOW_MS,
    );
  } else {
    // Start new pending entry
    const timeoutId = setTimeout(() => flush(phoneNumber), DEBOUNCE_WINDOW_MS);
    pending.set(phoneNumber, {
      messages: [message],
      timeoutId,
      callback,
    });
  }
}

/**
 * Flush pending messages for a user
 */
async function flush(phoneNumber: string): Promise<void> {
  const entry = pending.get(phoneNumber);
  if (!entry) return;

  pending.delete(phoneNumber);

  // Aggregate message texts
  const aggregatedText = entry.messages.map((m) => m.text).join(" ");

  // Use oldest WhatsApp timestamp for delay calculation
  const oldestTimestamp = Math.min(
    ...entry.messages.map((m) => m.whatsappTimestamp),
  );

  // Use latest messageId for read receipt
  const latestMessage = entry.messages[entry.messages.length - 1];
  const latestMessageId = latestMessage?.messageId || "";

  try {
    await entry.callback(aggregatedText, oldestTimestamp, latestMessageId);
  } catch (error) {
    console.error(`[Aggregator] Handler failed for ${phoneNumber}:`, error);
  }
}

/**
 * Get count of users with pending messages (for monitoring)
 */
function getPendingUserCount(): number {
  return pending.size;
}

/**
 * Force flush all pending messages (for graceful shutdown)
 */
async function flushAll(): Promise<void> {
  const phoneNumbers = Array.from(pending.keys());
  for (const phoneNumber of phoneNumbers) {
    const entry = pending.get(phoneNumber);
    if (entry) {
      clearTimeout(entry.timeoutId);
      await flush(phoneNumber);
    }
  }
}

export const messageAggregator = {
  add,
  getPendingUserCount,
  flushAll,
};
