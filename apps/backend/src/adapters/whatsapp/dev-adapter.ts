import process from "node:process";
import type { WhatsAppAdapter } from "./types.ts";
import { createLogger } from "../../lib/logger.ts";

const logger = createLogger("whatsapp");

const NOTIFIER_URL = process.env.NOTIFIER_URL || "http://localhost:3001";
const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";

export const DevAdapter: WhatsAppAdapter = {
  async sendMessage(to: string, content: string): Promise<string | null> {
    try {
      const response = await fetch(`${NOTIFIER_URL}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: to, content }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { to, status: response.status, error: errorText },
          "Dev adapter send failed",
        );
        return null;
      }

      const data = (await response.json()) as {
        status: string;
        messageId?: string;
      };
      return data.messageId ?? null;
    } catch (error) {
      logger.error({ error, to }, "Dev adapter send error");
      return null;
    }
  },

  async sendImage(
    to: string,
    imagePath: string,
    caption?: string,
  ): Promise<string | null> {
    const imageUrl = `${PUBLIC_URL}/static/${imagePath}`;

    try {
      const response = await fetch(`${NOTIFIER_URL}/send-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: to, imageUrl, caption }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { to, imagePath, error: errorText },
          "Dev adapter image send failed",
        );
        return null;
      }

      const data = (await response.json()) as {
        status: string;
        messageId?: string;
      };
      return data.messageId ?? null;
    } catch (error) {
      logger.error({ error, to, imagePath }, "Dev adapter image send error");
      return null;
    }
  },

  async markAsRead(_messageId: string): Promise<void> {
    // whatsapp-web.js handles read receipts automatically
  },
};
