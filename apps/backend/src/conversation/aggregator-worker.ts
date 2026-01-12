import {
  getReadyForAggregation,
  markAsProcessing,
  markAsProcessed,
  countPending,
  countFailed,
} from "./message-inbox.ts";
import { handleMessage } from "./handler/index.ts";
import { createLogger } from "../lib/logger.ts";

const logger = createLogger("aggregator");

// Time window for possible new messages before processing
const QUIET_WINDOW_MS = 2000;
const POLL_INTERVAL_MS = 100; // Check for ready messages every 100ms

let isRunning = false;
let workerPromise: Promise<void> | null = null;

export function startAggregatorWorker(): void {
  if (isRunning) {
    logger.debug("Worker already running");
    return;
  }

  isRunning = true;
  logger.info("Aggregator worker started");

  workerPromise = runWorkerLoop();
}

export async function stopAggregatorWorker(): Promise<void> {
  if (!isRunning) {
    return;
  }

  isRunning = false;

  if (workerPromise) {
    await workerPromise;
  }

  logger.info("Aggregator worker stopped");
}

async function runWorkerLoop(): Promise<void> {
  while (isRunning) {
    try {
      await processReadyMessages();
    } catch (error) {
      logger.error({ error }, "Aggregator loop failed");
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

async function processReadyMessages(): Promise<void> {
  const readyGroups = getReadyForAggregation(QUIET_WINDOW_MS);

  if (readyGroups.length === 0) {
    return;
  }

  logger.debug({ count: readyGroups.length }, "Processing message groups");

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

    logger.debug(
      { phoneNumber: group.phone_number, ids: group.ids },
      "Processing group",
    );

    await handleMessage({
      phoneNumber: group.phone_number,
      content: group.aggregated_text,
      timestamp: group.oldest_timestamp,
      messageId: group.latest_message_id,
    });

    markAsProcessed(group.ids);
  } catch (error) {
    logger.error(
      { error, phoneNumber: group.phone_number },
      "Group processing failed",
    );
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
