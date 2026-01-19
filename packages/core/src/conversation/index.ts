export { transition } from "./transition.ts";
export { transitionOfferingProducts } from "./phases/offering-products.ts";
export { transitionCheckingEligibility } from "./phases/checking-eligibility.ts";
export type {
  ConversationPhase,
  ConversationMetadata,
  EnrichmentRequest,
  EnrichmentResult,
  TransitionResult,
  TransitionInput,
  Command,
} from "./types.ts";
