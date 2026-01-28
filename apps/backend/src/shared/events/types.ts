export type { DomainEvent } from "@totem/types";
import { createTraceId } from "@totem/utils";

export function createEvent<T extends string, P>(
  type: T,
  payload: P,
  options?: { traceId?: string },
): { type: T; payload: P; timestamp: number; traceId: string } {
  return {
    type,
    payload,
    timestamp: Date.now(),
    traceId: options?.traceId || createTraceId(),
  };
}
