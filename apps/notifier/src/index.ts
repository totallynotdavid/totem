import { startServer } from "./server.ts";
import { initializeWhatsAppClient } from "./client.ts";

console.log("Starting notifier service...");

await initializeWhatsAppClient();
await startServer();

console.log("Notifier service is up");
