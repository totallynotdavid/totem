import { db } from "../../../db/index.ts";

export function getStuckConversations(): {
  phone_number: string;
  context_data: string;
}[] {
  return db
    .prepare(
      `SELECT phone_number, context_data 
       FROM conversations 
       WHERE json_extract(context_data, '$.phase.phase') = 'waiting_for_recovery'`,
    )
    .all() as { phone_number: string; context_data: string }[];
}

export function countWaitingForRecovery(): number {
  const result = db
    .prepare(
      `SELECT COUNT(*) as count 
       FROM conversations 
       WHERE json_extract(context_data, '$.phase.phase') = 'waiting_for_recovery'`,
    )
    .get() as { count: number };

  return result.count;
}
