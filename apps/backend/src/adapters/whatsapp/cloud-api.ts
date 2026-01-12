import process from "node:process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { WhatsAppAdapter } from "./types.ts";
import { createLogger } from "../../lib/logger.ts";

const logger = createLogger("whatsapp");
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

function getPublicUrl(): string {
  const tunnelFile = resolve(import.meta.dir, "../../../../../.cloudflare-url");

  if (existsSync(tunnelFile)) {
    const url = readFileSync(tunnelFile, "utf-8").trim();
    if (url) {
      return url;
    }
  }

  return process.env.PUBLIC_URL || "http://localhost:3000";
}

const API_URL = `https://graph.facebook.com/v17.0/${PHONE_ID}/messages`;

export const CloudApiAdapter: WhatsAppAdapter = {
  async sendMessage(to: string, content: string): Promise<string | null> {
    if (!TOKEN || !PHONE_ID) {
      logger.warn("WhatsApp not configured");
      return null;
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: content },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error(
          { error, to, status: response.status },
          "WhatsApp send failed",
        );
        return null;
      }

      const data = (await response.json()) as {
        messages?: Array<{ id: string }>;
      };
      return data.messages?.[0]?.id ?? null;
    } catch (error) {
      logger.error({ error, to }, "WhatsApp send failed");
      return null;
    }
  },

  async sendImage(
    to: string,
    imagePath: string,
    caption?: string,
  ): Promise<string | null> {
    if (!TOKEN || !PHONE_ID) {
      logger.warn({ imagePath }, "WhatsApp not configured");
      return null;
    }

    const publicUrl = getPublicUrl();
    const link = `${publicUrl}/static/${imagePath}`;

    try {
      const payload: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { link, ...(caption && { caption }) },
      };

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        logger.error(
          { error, to, imagePath, link, status: response.status, payload },
          "WhatsApp image send failed",
        );
        return null;
      }

      const responseData = (await response.json()) as {
        messages?: Array<{ id: string }>;
      };

      return responseData.messages?.[0]?.id ?? null;
    } catch (error) {
      logger.error({ error, to, imagePath }, "WhatsApp image send failed");
      return null;
    }
  },

  async markAsRead(messageId: string): Promise<void> {
    if (!TOKEN || !PHONE_ID) return;

    try {
      await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
          typing_indicator: { type: "text" },
        }),
      });
    } catch {
      // Non-critical, silently fail
    }
  },
};
