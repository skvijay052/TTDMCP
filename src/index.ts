import { createServer as createHttpServer } from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { browser, loginHandoff, mcpHandler } from "./mcp/server.js";
import { renderLoginPage } from "./browser/login-handoff.js";

const port = Number(process.env.PORT ?? 10000);
const mcpNodeHandler = toNodeHandler(mcpHandler);

// ChatGPT Custom MCP supports a public/no-auth connection.
// Keep auth available as an explicit deployment setting for protected deployments.
const requireAuth = process.env.MCP_REQUIRE_AUTH === "true";
const expectedToken = process.env.MCP_ACCESS_TOKEN;

const httpServer = createHttpServer(async (req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      service: "ttd-mcp",
      mcpAuthRequired: requireAuth
    }));
    return;
  }

  if (req.url?.startsWith("/human-login")) {
    const parsed = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
    const token = parsed.searchParams.get("token");

    if (!token) {
      res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
      res.end("Missing login handoff token.");
      return;
    }

    if (req.method === "GET") {
      const handoff = loginHandoff.get(token);
      if (!handoff) {
        res.writeHead(410, { "content-type": "text/plain; charset=utf-8" });
        res.end("Login handoff expired. Start a new TTD login from ChatGPT.");
        return;
      }
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(renderLoginPage(handoff));
      return;
    }

    if (req.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
      try {
        const handoff = loginHandoff.get(token);
        if (!handoff) throw new Error("Login handoff expired. Start a new TTD login.");
        if (handoff.stage === "PHONE") {
          await loginHandoff.submitPhone(token, body.get("phone") ?? "");
        } else if (handoff.stage === "OTP") {
          await loginHandoff.submitOtp(token, body.get("otp") ?? "");
        }
        const next = loginHandoff.get(token);
        res.writeHead(303, { location: `/human-login?token=${token}` });
        res.end();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Login step failed.";
        res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
        res.end(message);
        return;
      }
    }

    res.writeHead(405, { "content-type": "text/plain; charset=utf-8" });
    res.end("Method not allowed.");
    return;
  }

  if (req.url?.startsWith("/mcp")) {
    if (requireAuth) {
      const auth = req.headers.authorization;
      const providedToken = auth?.startsWith("Bearer ")
        ? auth.slice(7)
        : undefined;

      if (!expectedToken || providedToken !== expectedToken) {
        res.writeHead(401, {
          "content-type": "application/json",
          "www-authenticate": 'Bearer realm="ttd-mcp"'
        });
        res.end(JSON.stringify({ error: "Unauthorized" }));
        return;
      }
    }

    await mcpNodeHandler(req, res);
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(port, "0.0.0.0", () => {
  console.error(
    `TTD MCP listening on port ${port} (MCP auth required: ${requireAuth})`
  );
});
