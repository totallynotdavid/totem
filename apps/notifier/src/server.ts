import { Hono } from "hono";
import { enqueueMessage } from "./queue.ts";
import { client } from "./client.ts";
import process from "node:process";

const app = new Hono();

app.post("/notify", async (c) => {
    const { channel, message } = await c.req.json();

    if (!channel || !message) {
        return c.json({ error: "channel and message required" }, 400);
    }

    if (channel !== "agent" && channel !== "dev") {
        return c.json({ error: "channel must be 'agent' or 'dev'" }, 400);
    }

    enqueueMessage(channel, message);

    return c.json({ status: "queued" });
});

app.get("/health", (c) => {
    const isReady = client?.info !== undefined;

    return c.json({
        status: isReady ? "ready" : "initializing",
        timestamp: new Date().toISOString(),
    });
});

export async function startServer() {
    const port = parseInt(process.env.NOTIFIER_PORT || "3001", 10);

    Bun.serve({
        port,
        fetch: app.fetch,
    });

    console.log(`Notifier HTTP server running on http://localhost:${port}`);
}
