import process from "node:process";
import type { WhatsAppAdapter } from "./types.ts";
import { createLogger } from "../../lib/logger.ts";
import { getPublicUrl } from "@totem/utils";
import { createAbortTimeout, TIMEOUTS } from "../../config/timeouts.ts";

const logger = createLogger("whatsapp");
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID;

const API_URL = `https://graph.facebook.com/v17.0/${PHONE_ID}/messages`;

export const CloudApiAdapter: WhatsAppAdapter = {
  async sendMessage(to: string, content: string): Promise<string | null> {
    if (!TOKEN || !PHONE_ID) {
      logger.warn("WhatsApp not configured");
      return null;
    }

    const { signal, cleanup } = createAbortTimeout(TIMEOUTS.WHATSAPP_SEND);

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
        signal,
      });

      cleanup();

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
      cleanup();

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          logger.error(
            { to, timeoutMs: TIMEOUTS.WHATSAPP_SEND },
            "WhatsApp send timeout",
          );
        } else {
          logger.error({ error, to }, "WhatsApp send failed");
        }
      }

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
    const link = `${publicUrl}/media/${imagePath}`;

    const { signal, cleanup } = createAbortTimeout(TIMEOUTS.WHATSAPP_IMAGE);

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
        signal,
      });

      cleanup();

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
      cleanup();

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          logger.error(
            { to, imagePath, timeoutMs: TIMEOUTS.WHATSAPP_IMAGE },
            "WhatsApp image send timeout",
          );
        } else {
          logger.error({ error, to, imagePath }, "WhatsApp image send failed");
        }
      }

      return null;
    }
  },

  async markAsRead(messageId: string): Promise<void> {
    if (!TOKEN || !PHONE_ID) return;

    const { signal, cleanup } = createAbortTimeout(5_000);

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
        signal,
      });

      cleanup();
    } catch {
      cleanup();
      // Non-critical, silently fail
    }
  },
};
