import type { ConversationMessage, MessageType } from "@totem/types";

export interface WhatsAppAdapter {
  sendMessage(to: string, content: string): Promise<string | null>;
  sendImage(
    to: string,
    imagePath: string,
    caption?: string,
  ): Promise<string | null>;
  markAsRead(messageId: string): Promise<void>;
}

export type MessageDirection = "inbound" | "outbound";

export type { ConversationMessage, MessageType };
