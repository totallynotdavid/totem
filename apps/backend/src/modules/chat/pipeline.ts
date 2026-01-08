import { transition, matchCategory } from "@totem/core";
import type { Conversation } from "@totem/types";
import type { Command } from "@totem/core";
import {
  getOrCreateConversation,
  updateConversationState,
  buildStateContext,
  checkSessionTimeout,
  resetSession,
} from "./context.ts";
import { isMaintenanceMode } from "../settings/system.ts";
import * as LLM from "../llm/index.ts";
import { BundleService } from "../../services/catalog/index.ts";
import { logLLMError } from "../../services/llm-errors.ts";

const MAINTENANCE_MESSAGE =
  "¡Hola! 👋 En este momento estamos realizando mejoras en nuestro sistema. " +
  "Por favor, inténtalo de nuevo en unos minutos. ¡Gracias por tu paciencia!";

export type PipelineOutput = {
  commands: Command[];
  shouldAssignAgent: boolean;
};

export async function processMessagePipeline(
  phoneNumber: string,
  message: string,
  metadata?: { isBacklog: boolean; oldestMessageAge: number },
): Promise<PipelineOutput> {
  // Check maintenance mode
  if (isMaintenanceMode()) {
    return {
      commands: [{ type: "SEND_MESSAGE", content: MAINTENANCE_MESSAGE }],
      shouldAssignAgent: false,
    };
  }

  const conv = getOrCreateConversation(phoneNumber);

  if (conv.current_state === "CLOSING" || conv.current_state === "ESCALATED") {
    resetSession(phoneNumber);
    const resetConv = getOrCreateConversation(phoneNumber);
    return await executeTransition(resetConv, message, metadata);
  }

  if (checkSessionTimeout(conv) && conv.current_state !== "INIT") {
    resetSession(phoneNumber);
    const resetConv = getOrCreateConversation(phoneNumber);
    return await executeTransition(resetConv, message, metadata);
  }

  return await executeTransition(conv, message, metadata);
}

async function executeTransition(
  conv: Conversation,
  message: string,
  metadata?: { isBacklog: boolean; oldestMessageAge: number },
): Promise<PipelineOutput> {
  const context = buildStateContext(conv);
  const state = conv.current_state;

  let backlogResponse: string | null = null;
  if (metadata?.isBacklog && state === "INIT") {
    const ageMinutes = Math.floor(metadata.oldestMessageAge / 60000);
    const result = await LLM.handleBacklogResponse(message, ageMinutes);
    if (result.success) {
      backlogResponse = result.data;
    } else {
      logLLMError(
        conv.phone_number,
        "handleBacklogResponse",
        result.error,
        state,
        {
          ageMinutes,
        },
      );
      backlogResponse = "¡Hola! Disculpa la demora. ¿En qué puedo ayudarte?";
    }
  }

  if (state !== "INIT" && state !== "WAITING_PROVIDER") {
    const isQuestionResult = await LLM.isQuestion(message);

    if (!isQuestionResult.success) {
      logLLMError(
        conv.phone_number,
        "isQuestion",
        isQuestionResult.error,
        state,
      );
    } else if (isQuestionResult.data) {
      const escalateResult = await LLM.shouldEscalate(message);

      if (!escalateResult.success) {
        logLLMError(
          conv.phone_number,
          "shouldEscalate",
          escalateResult.error,
          state,
        );
        context.llmDetectedQuestion = true;
        context.llmRequiresHuman = true;
      } else if (escalateResult.data) {
        context.llmDetectedQuestion = true;
        context.llmRequiresHuman = true;
      } else {
        const availableCategories =
          context.segment === "fnb"
            ? BundleService.getAvailableCategories("fnb")
            : BundleService.getAvailableCategories("gaso");

        const answerResult = await LLM.answerQuestion(message, {
          segment: context.segment,
          creditLine: context.creditLine,
          state,
          availableCategories,
        });

        if (!answerResult.success) {
          logLLMError(
            conv.phone_number,
            "answerQuestion",
            answerResult.error,
            state,
            {
              segment: context.segment,
              creditLine: context.creditLine,
            },
          );
          context.llmDetectedQuestion = true;
          context.llmGeneratedAnswer = "Déjame ayudarte con eso...";
          context.llmRequiresHuman = false;
        } else {
          context.llmDetectedQuestion = true;
          context.llmGeneratedAnswer = answerResult.data;
          context.llmRequiresHuman = false;
        }
      }
    }
  }

  if (state === "OFFER_PRODUCTS") {
    const matchedCategory = matchCategory(message);

    if (matchedCategory) {
      context.extractedCategory = matchedCategory;
      context.usedLLM = false;
    } else {
      const availableCategories =
        context.segment === "fnb"
          ? BundleService.getAvailableCategories("fnb")
          : BundleService.getAvailableCategories("gaso");

      const categoryResult = await LLM.extractCategory(
        message,
        availableCategories,
      );

      if (!categoryResult.success) {
        logLLMError(
          conv.phone_number,
          "extractCategory",
          categoryResult.error,
          state,
          {
            availableCategories,
          },
        );
      } else if (categoryResult.data) {
        context.extractedCategory = categoryResult.data;
        context.usedLLM = true;
      }
    }
  }

  const output = transition({
    currentState: conv.current_state,
    message,
    context,
  });

  updateConversationState(
    conv.phone_number,
    output.nextState,
    output.updatedContext,
  );

  const shouldAssignAgent =
    (output.updatedContext.purchaseConfirmed ?? false) && !conv.is_simulation;

  let commands = output.commands;
  if (backlogResponse) {
    commands = [
      { type: "SEND_MESSAGE", content: backlogResponse },
      ...output.commands,
    ];
  }

  return {
    commands,
    shouldAssignAgent,
  };
}
