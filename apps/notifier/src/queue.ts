import { client, getGroupJID } from "./client.ts";

type QueuedMessage = {
    channel: "agent" | "dev";
    message: string;
    attempts: number;
};

const queue: QueuedMessage[] = [];
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

let processing = false;

export function enqueueMessage(channel: "agent" | "dev", message: string) {
    queue.push({ channel, message, attempts: 0 });
    processQueue();
}

async function processQueue() {
    if (processing || queue.length === 0) return;

    processing = true;

    while (queue.length > 0) {
        const item = queue.shift()!;

        try {
            await sendMessage(item.channel, item.message);
            console.log(
                `Sent to ${item.channel}: ${item.message.substring(0, 50)}...`,
            );
        } catch (error) {
            console.error(`Failed to send to ${item.channel}:`, error);

            item.attempts++;
            if (item.attempts < MAX_RETRIES) {
                console.log(
                    `⟳ Retry ${item.attempts}/${MAX_RETRIES} in ${RETRY_DELAY_MS}ms`,
                );
                await new Promise((resolve) =>
                    setTimeout(resolve, RETRY_DELAY_MS),
                );
                queue.unshift(item); // Re-queue at front
            } else {
                console.error(
                    `Giving up on message after ${MAX_RETRIES} attempts`,
                );
            }
        }

        // Rate limiting: wait 1 second between messages
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    processing = false;
}

async function sendMessage(channel: "agent" | "dev", message: string) {
    if (!client) {
        throw new Error("WhatsApp client not initialized");
    }

    const jid = getGroupJID(channel);
    if (!jid) {
        throw new Error(`No group JID configured for channel: ${channel}`);
    }

    await client.sendMessage(jid, message);
}
