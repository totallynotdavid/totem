import process from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Message } from "whatsapp-web.js";
import { createLogger } from "./logger.ts";

const logger = createLogger("forwarder");

function getBackendUrl(): string {
  const tunnelFile = resolve(import.meta.dir, "../../.cloudflare-url");
  if (existsSync(tunnelFile)) {
    const url = readFileSync(tunnelFile, "utf-8").trim();
    if (url) {
      logger.debug({ url, source: "tunnel" }, "Backend URL configured");
      return url;
    }
  }
  const fallback = process.env.BACKEND_URL || "http://localhost:3000";
  logger.debug({ url: fallback, source: "env" }, "Backend URL configured");
  return fallback;
}

const BACKEND_URL = getBackendUrl();

// Deduplication cache for WhatsApp Web JS (can fire duplicate events)
const forwardedMessages = new Set<string>();
const FORWARD_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function forwardToBackend(msg: Message): Promise<void> {
  const messageId = msg.id._serialized;

  // Skip if already forwarded
  if (forwardedMessages.has(messageId)) {
    return;
  }

  forwardedMessages.add(messageId);

  // Cleanup old entries after TTL
  setTimeout(() => {
    forwardedMessages.delete(messageId);
  }, FORWARD_CACHE_TTL_MS);
  // Extract phone number - handle both @c.us and @lid formats
  let phoneNumber = msg.from.replace("@c.us", "").replace("@lid", "");

  // For @lid format, try to get the actual phone number from contact
  if (msg.from.endsWith("@lid")) {
    try {
      const contact = await msg.getContact();
      if (contact.number) {
        phoneNumber = contact.number;
      }
    } catch (e) {
      logger.warn({ lid: msg.from }, "LID resolution failed");
    }
  }

  // Map whatsapp-web.js message types to Cloud API format
  const messageType = msg.type === "chat" ? "text" : msg.type;

  // Build payload matching WhatsApp Cloud API webhook format
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: phoneNumber,
                  id: msg.id._serialized,
                  timestamp: msg.timestamp,
                  type: messageType,
                  text: msg.type === "chat" ? { body: msg.body } : undefined,
                },
              ],
            },
          },
        ],
      },
    ],
  };

  try {
    const response = await fetch(`${BACKEND_URL}/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(
        {
          status: response.status,
          error: errorText,
          messageId,
          phoneNumber,
        },
        "Backend rejected message",
      );
    }
  } catch (error) {
    logger.error({ error, messageId, phoneNumber }, "Forward failed");
  }
}
