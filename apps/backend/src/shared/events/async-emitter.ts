import type { DomainEvent } from "./types.ts";
import { EventBus } from "./event-bus.ts";
import { createLogger } from "../../lib/logger.ts";

const logger = createLogger("async-emitter");

export class AsyncEventEmitter {
  constructor(private eventBus: EventBus) {}

  /**
   * Emit event and wait for all handlers to complete.
   * Use for critical operations that must succeed before response.
   */
  async emitCritical(event: DomainEvent): Promise<void> {
    await this.eventBus.emit(event);
  }

  /**
   * Emit event but don't wait for handlers.
   * Use for side effects (notifications, analytics) that shouldn't block.
   */
  emitAsync(event: DomainEvent): void {
    // Schedule in background, don't await
    Promise.resolve()
      .then(() => this.eventBus.emit(event))
      .catch((error) => {
        logger.error(
          { error, eventType: event.type },
          "Async event handler failed",
        );
      });
  }
}
