import {
  getReadyForAggregation,
  markAsProcessing,
  markAsProcessed,
  markAsFailed,
  countPending,
  countFailed,
} from "./message-inbox.ts";
import { handleMessage } from "./handler/index.ts";
import { conversationLogger } from "@totem/logger";

// Time window for possible new messages before processing
const QUIET_WINDOW_MS = 2000;
const POLL_INTERVAL_MS = 100; // Check for ready messages every 100ms

let isRunning = false;
let workerPromise: Promise<void> | null = null;

export function startAggregatorWorker(): void {
  if (isRunning) {
    conversationLogger.warn("Aggregator worker already running");
    return;
  }

  isRunning = true;
  conversationLogger.info("Aggregator worker started");

  workerPromise = runWorkerLoop();
}

export async function stopAggregatorWorker(): Promise<void> {
  if (!isRunning) {
    return;
  }

  conversationLogger.info("Stopping aggregator worker");
  isRunning = false;

  if (workerPromise) {
    await workerPromise;
  }

  conversationLogger.info("Aggregator worker stopped");
}

async function runWorkerLoop(): Promise<void> {
  while (isRunning) {
    try {
      await processReadyMessages();
    } catch (error) {
      conversationLogger.error({ error }, "Error in aggregator worker loop");
    }

    // Sleep before next poll
    await sleep(POLL_INTERVAL_MS);
  }
}

async function processReadyMessages(): Promise<void> {
  const readyGroups = getReadyForAggregation(QUIET_WINDOW_MS);

  if (readyGroups.length === 0) {
    return;
  }

  conversationLogger.info(
    { count: readyGroups.length },
    "Processing ready message groups",
  );

  await Promise.all(readyGroups.map((group) => processGroup(group)));
}

async function processGroup(group: {
  phone_number: string;
  ids: string;
  aggregated_text: string;
  oldest_timestamp: number;
  latest_message_id: string;
}): Promise<void> {
  try {
    // Mark as processing to prevent double-processing
    markAsProcessing(group.ids);

    conversationLogger.info(
      { phoneNumber: group.phone_number, ids: group.ids },
      "Processing group",
    );

    // Process conversation
    await handleMessage({
      phoneNumber: group.phone_number,
      content: group.aggregated_text,
      timestamp: group.oldest_timestamp,
      messageId: group.latest_message_id,
    });

    // Mark as successfully processed
    markAsProcessed(group.ids);

    conversationLogger.info(
      { phoneNumber: group.phone_number },
      "Successfully processed group",
    );
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    conversationLogger.error(
      { error, phoneNumber: group.phone_number },
      "Failed to process group",
    );

    // Mark as failed for retry later
    markAsFailed(group.ids, errorMessage);
  }
}

export function getWorkerStatus(): {
  running: boolean;
  pending: number;
  failed: number;
} {
  return {
    running: isRunning,
    pending: countPending(),
    failed: countFailed(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
