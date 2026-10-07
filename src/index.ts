import { createServer as createHttpServer } from "node:http";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { mcpHandler } from "./mcp/server.js";

const port = Number(process.env.PORT ?? 10000);
const mcpNodeHandler = toNodeHandler(mcpHandler);

const httpServer = createHttpServer(async (req, res) => {
  if (req.url === "/health" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok", service: "ttd-mcp" }));
    return;
  }

  if (req.url?.startsWith("/mcp")) {
    await mcpNodeHandler(req, res);
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

httpServer.listen(port, "0.0.0.0", () => {
  console.error(`TTD MCP listening on port ${port}`);
});
