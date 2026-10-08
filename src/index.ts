import { createServer as createHttpServer } from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { mcpHandler } from "./mcp/server.js";

const port = Number(process.env.MCP_PORT ?? 10001);
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

  if (req.url === "/browser-info" && req.method === "GET") {
    const token = process.env.BROWSER_ACCESS_TOKEN;
    if (!token) { res.writeHead(503, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: false, message: "BROWSER_ACCESS_TOKEN is not configured." })); return; }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, browserUrl: `/browser/vnc.html?autoconnect=true&resize=scale&path=websockify&token=${encodeURIComponent(token)}` }));
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
