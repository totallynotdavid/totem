import type {
  IncomingMessage,
  MessageType,
  QuotedMessageContext,
} from "@totem/types";

function mapCloudApiType(cloudApiType: string): MessageType {
  switch (cloudApiType) {
    case "text":
      return "text";
    case "image":
      return "image";
    case "document":
      return "document";
    case "audio":
      return "audio";
    case "video":
      return "video";
    default:
      return "text"; // Default fallback
  }
}

export function parseIncomingMessage(webhookMessage: any): IncomingMessage {
  const quotedContext: QuotedMessageContext | undefined = webhookMessage.context
    ?.quoted_message
    ? {
        id: webhookMessage.context.quoted_message.id,
        body: webhookMessage.context.quoted_message.body || "",
        type: mapCloudApiType(
          webhookMessage.context.quoted_message.type || "text",
        ),
        timestamp:
          (webhookMessage.context.quoted_message.timestamp || 0) * 1000,
      }
    : undefined;

  return {
    id: webhookMessage.id,
    from: webhookMessage.from,
    body: webhookMessage.text?.body || "",
    type: mapCloudApiType(webhookMessage.type),
    timestamp:
      (webhookMessage.timestamp || Math.floor(Date.now() / 1000)) * 1000,
    quotedContext,
  };
}
