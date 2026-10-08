import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { BrowserManager } from "../browser/browser-manager.js";
import { BookingStateStore } from "../state/booking-state.js";
import { AvailabilityFlow } from "../ttd/flows/availability-flow.js";
import { TtdClient } from "../ttd/client.js";
import { DarshanPage } from "../ttd/pages/darshan.page.js";
import { debugPage } from "./tools/debug-page.js";
import { LoginHandoff } from "../browser/login-handoff.js";

export const browser = new BrowserManager();
export const state = new BookingStateStore();
const availability = new AvailabilityFlow(browser, state);
export const loginHandoff = new LoginHandoff(browser, state);

async function prepareDarshanPage() {
  const page = await browser.openHome();
  const client = new TtdClient(page);
  await client.openDarshanPage();
  return new DarshanPage(page);
}

function blockedForManualAction() {
  const current = state.get();
  return current.phase === "USER_ACTION_REQUIRED";
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "ttd-mcp",
    version: "0.2.2"
  });

  server.registerTool(
    "ttd_start_login",
    {
      title: "Start TTD mobile login",
      description: "Open the TTD login session and return a temporary mobile handoff URL where the user can enter their mobile number and OTP. The MCP never stores the phone number or OTP and does not bypass CAPTCHA or other security controls.",
      inputSchema: z.object({})
    },
    async () => {
      const handoff = loginHandoff.create();
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, handoffUrl: `/human-login?token=${handoff.token}`, expiresAt: new Date(handoff.expiresAt).toISOString(), message: handoff.message }, null, 2) }]
      };
    }
  );

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
      title: "Inspect TTD darshan availability",
      description: "Open the official TTD portal and return visible discovery data for dates, slots, buttons and inputs. Read-only; it does not claim availability unless the page exposes it.",
      inputSchema: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
      })
    },
    async ({ date }) => {
      const result = await availability.check(date);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.registerTool(
    "ttd_debug_page",
    {
      title: "Debug TTD page",
      description: "Read-only diagnostics for the current TTD page, including DOM counts, frames, resource failures, console errors, page errors, and a screenshot path. It does not select dates, slots, tickets, or perform booking actions.",
      inputSchema: z.object({})
    },
    async () => {
      const page = await browser.openHome();
      const result = await debugPage(page, (name) => browser.screenshot(name));
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
  );

  server.registerTool(
    "ttd_select_date",
    {
      title: "Select TTD darshan date",
      description: "Select a visible matching darshan date. Stops if manual login/OTP/CAPTCHA is required and never bypasses security controls.",
      inputSchema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
    },
    async ({ date }) => {
      if (blockedForManualAction()) {
        return { content: [{ type: "text", text: JSON.stringify({ ok: false, state: state.get(), message: "Manual login/OTP/CAPTCHA action is required first." }, null, 2) }] };
      }
      const darshan = await prepareDarshanPage();
      const result = await darshan.selectDate(date);
      const next = result.selected
        ? state.set("DATE_SELECTED", { date, message: `Selected date ${date}.` })
        : state.set("ERROR", { date, message: `Could not find a visible date control for ${date}; no date was selected.` });
      return { content: [{ type: "text", text: JSON.stringify({ ok: result.selected, matchedText: result.matchedText ?? null, state: next }, null, 2) }] };
    }
  );

  server.registerTool(
    "ttd_select_slot",
    {
      title: "Select TTD darshan slot",
      description: "Select a visible slot after a date has been selected. Does not submit payment or bypass CAPTCHA.",
      inputSchema: z.object({ slot: z.string().min(1) })
    },
    async ({ slot }) => {
      const current = state.get();
      if (current.phase !== "DATE_SELECTED") {
        return { content: [{ type: "text", text: JSON.stringify({ ok: false, state: current, message: "Select a date first." }, null, 2) }] };
      }
      const darshan = await prepareDarshanPage();
      const result = await darshan.selectSlot(slot);
      const next = result.selected
        ? state.set("SLOT_SELECTED", { slot, message: `Selected slot ${slot}.` })
        : state.set("ERROR", { slot, message: `Could not find a visible slot control matching ${slot}; no slot was selected.` });
      return { content: [{ type: "text", text: JSON.stringify({ ok: result.selected, matchedText: result.matchedText ?? null, state: next }, null, 2) }] };
    }
  );

  server.registerTool(
    "ttd_select_ticket_count",
    {
      title: "Select TTD ticket count",
      description: "Select the requested number of tickets from a visible ticket/quantity control. Does not continue to payment.",
      inputSchema: z.object({ count: z.number().int().min(1).max(10) })
    },
    async ({ count }) => {
      const current = state.get();
      if (current.phase !== "SLOT_SELECTED") {
        return { content: [{ type: "text", text: JSON.stringify({ ok: false, state: current, message: "Select a date and slot first." }, null, 2) }] };
      }
      const darshan = await prepareDarshanPage();
      const result = await darshan.selectTicketCount(count);
      const next = result.selected
        ? state.set("TICKETS_SELECTED", { ticketCount: count, message: `Selected ${count} ticket(s).` })
        : state.set("ERROR", { ticketCount: count, message: "Could not find a visible ticket-count control; no ticket count was selected." });
      return { content: [{ type: "text", text: JSON.stringify({ ok: result.selected, state: next }, null, 2) }] };
    }
  );

  return server;
}

export const mcpHandler = createMcpHandler(() => createServer());
