import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { BrowserManager } from "../browser/browser-manager.js";
import { BookingStateStore } from "../state/booking-state.js";
import { AvailabilityFlow } from "../ttd/flows/availability-flow.js";

const browser = new BrowserManager();
const state = new BookingStateStore();
const availability = new AvailabilityFlow(browser, state);

export function createServer(): McpServer {
  const server = new McpServer({
    name: "ttd-mcp",
    version: "0.1.0"
  });

  server.registerTool(
    "ttd_get_status",
    {
      title: "Get TTD browser status",
      description: "Return browser, page, URL, authentication hints, and booking state. Does not perform booking.",
      inputSchema: z.object({})
    },
    async () => {
      const status = await browser.getStatus();
      return {
        content: [{ type: "text", text: JSON.stringify({ ...status, bookingState: state.get() }, null, 2) }]
      };
    }
  );

  server.registerTool(
    "ttd_check_availability",
    {
      title: "Check TTD darshan availability",
      description: "Open the TTD darshan page and inspect visible date/slot availability. This is read-only.",
      inputSchema: z.object({
        date: z.string().optional().describe("Target date in YYYY-MM-DD format when known.")
      })
    },
    async ({ date }) => {
      const result = await availability.check(date);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  return server;
}

export async function startMcpServer(): Promise<void> {
  await serveStdio(() => createServer());
}
